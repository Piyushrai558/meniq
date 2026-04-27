const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { query } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const PLANS = {
  basic: { amount: 29900, label: 'Basic Plan', menu_limit: 3 },
  pro:   { amount: 69900, label: 'Pro Plan',   menu_limit: -1 },
};

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

function razorpayErrMsg(err) {
  return err?.error?.description || err?.description || err?.message || 'Payment gateway error';
}

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

  if (isDev && !razorpayConfigured()) {
    return res.json({
      order_id:   `dev_order_${Date.now()}`,
      amount:     PLANS[plan].amount,
      currency:   'INR',
      key_id:     'rzp_test_DEV_SIMULATION',
      plan_name:  PLANS[plan].label,
      dev_simulation: true,
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

    await query(
      'INSERT INTO payments (user_id, razorpay_order_id, plan, amount, status) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, order.id, plan, PLANS[plan].amount, 'pending']
    );

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
router.post('/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, dev_simulation } = req.body;

  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  // ── Dev simulation: skip HMAC check ──────────────────────────────────────
  if (isDev && dev_simulation && razorpay_order_id?.startsWith('dev_order_')) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await query('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3', [plan, expiresAt, req.user.id]);
      const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const user = userResult.rows[0];
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

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3', [plan, expiresAt, req.user.id]);
    await query(
      'UPDATE payments SET razorpay_payment_id = $1, status = $2 WHERE razorpay_order_id = $3',
      [razorpay_payment_id, 'paid', razorpay_order_id]
    );

    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
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
  }
});

module.exports = router;
