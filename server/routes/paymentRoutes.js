const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const PLANS = {
  basic: { amount: 29900, label: 'Basic Plan', menu_limit: 3 },
  pro:   { amount: 69900, label: 'Pro Plan',   menu_limit: -1 }, // -1 = unlimited
};

// Real keys look like rzp_test_XXXXX / rzp_live_XXXXX (no "PASTE" placeholder)
function razorpayConfigured() {
  const id  = process.env.RAZORPAY_KEY_ID     || '';
  const sec = process.env.RAZORPAY_KEY_SECRET || '';
  return (
    id.startsWith('rzp_') &&
    !id.includes('PASTE') &&
    sec.length > 10 &&
    !sec.includes('PASTE')
  );
}

function getRazorpay() {
  if (!razorpayConfigured()) {
    throw new Error(
      'Razorpay keys not set. Open .env and paste your Key ID and Key Secret from razorpay.com → Settings → API Keys.'
    );
  }
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Extract a readable message from Razorpay SDK errors (they use err.error.description)
function razorpayErrMsg(err) {
  return err?.error?.description || err?.description || err?.message || 'Payment gateway error';
}

// ── DEV-MODE PAYMENT SIMULATION ───────────────────────────────────────────────
// When Razorpay is not configured (placeholder keys), we allow a simulated
// payment in development so the plan upgrade flow can be tested end-to-end
// without real money or a live Razorpay account.
const isDev = process.env.NODE_ENV !== 'production';

function effectivePlan(user) {
  if (!user.plan || user.plan === 'free') return 'free';
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return 'free';
  return user.plan;
}

// ── GET /api/payments/plans ───────────────────────────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({
    plans: [
      {
        id: 'free', name: 'Free', price: 0,
        menu_limit: 1, item_limit: 15,
        features: ['1 menu', 'Up to 15 items', 'QR code generation', 'Basic analytics'],
      },
      {
        id: 'basic', name: 'Basic', price: 299,
        menu_limit: 3, item_limit: -1,
        features: ['3 menus', 'Unlimited items', 'QR code generator', 'Full analytics', 'Email support'],
      },
      {
        id: 'pro', name: 'Pro', price: 699,
        menu_limit: -1, item_limit: -1,
        features: ['Unlimited menus', 'Unlimited items', 'QR code generator', 'Full analytics', 'Custom branding', 'Priority support'],
      },
    ],
  });
});

// ── POST /api/payments/create-order ──────────────────────────────────────────
router.post('/create-order', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan selected' });

  // ── Dev simulation: skip Razorpay when keys are placeholder ──────────────
  if (isDev && !razorpayConfigured()) {
    return res.json({
      order_id:   `dev_order_${Date.now()}`,
      amount:     PLANS[plan].amount,
      currency:   'INR',
      key_id:     'rzp_test_DEV_SIMULATION',
      plan_name:  PLANS[plan].label,
      dev_simulation: true,   // frontend detects this and skips Razorpay checkout
    });
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   PLANS[plan].amount,
      currency: 'INR',
      receipt:  `rcpt_${req.user.id}_${Date.now()}`,
      notes:    { user_id: String(req.user.id), plan },
    });

    const db = getDb();
    db.prepare(
      'INSERT INTO payments (user_id, razorpay_order_id, plan, amount, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, order.id, plan, PLANS[plan].amount, 'pending');
    db.close();

    res.json({
      order_id:  order.id,
      amount:    PLANS[plan].amount,
      currency:  'INR',
      key_id:    process.env.RAZORPAY_KEY_ID,
      plan_name: PLANS[plan].label,
    });
  } catch (err) {
    res.status(500).json({ error: razorpayErrMsg(err) });
  }
});

// ── POST /api/payments/verify ─────────────────────────────────────────────────
router.post('/verify', authMiddleware, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, dev_simulation } = req.body;

  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  // ── Dev simulation: skip HMAC check ──────────────────────────────────────
  if (isDev && dev_simulation && razorpay_order_id?.startsWith('dev_order_')) {
    const db = getDb();
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(
        plan, expiresAt.toISOString(), req.user.id
      );
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      console.log(`[payments] DEV SIMULATION: upgraded user ${req.user.id} to ${plan}`);
      return res.json({
        success: true,
        user: {
          id: user.id, email: user.email, name: user.name,
          restaurant_name: user.restaurant_name,
          email_verified: !!user.email_verified,
          plan: effectivePlan(user),
          plan_expires_at: user.plan_expires_at,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    } finally {
      db.close();
    }
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ error: 'Missing payment details' });

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature)
    return res.status(400).json({ error: 'Payment verification failed' });

  const db = getDb();
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day subscription

    db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(
      plan, expiresAt.toISOString(), req.user.id
    );
    db.prepare(
      'UPDATE payments SET razorpay_payment_id = ?, status = ? WHERE razorpay_order_id = ?'
    ).run(razorpay_payment_id, 'paid', razorpay_order_id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({
      success: true,
      user: {
        id: user.id, email: user.email, name: user.name,
        restaurant_name: user.restaurant_name,
        email_verified: !!user.email_verified,
        plan: effectivePlan(user),
        plan_expires_at: user.plan_expires_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
