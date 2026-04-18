const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../database');
const { generateToken, authMiddleware } = require('../auth');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../mailer');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function safeUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    restaurant_name: u.restaurant_name,
    email_verified: !!u.email_verified,
    plan: u.plan || 'free',
    plan_expires_at: u.plan_expires_at || null,
  };
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { email, password, name, restaurant_name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'Email, password and name are required' });

  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = bcrypt.hashSync(password, 10);
    const verifyToken = randomToken();

    const result = db.prepare(
      'INSERT INTO users (email, password, name, restaurant_name, email_verify_token) VALUES (?, ?, ?, ?, ?)'
    ).run(email, hashed, name, restaurant_name || '', verifyToken);

    const user = { id: result.lastInsertRowid, email, name, restaurant_name: restaurant_name || '' };
    const token = generateToken(user);

    // Create a starter menu
    const slug =
      (restaurant_name || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' + Date.now();
    const menuResult = db
      .prepare('INSERT INTO menus (user_id, name, slug, restaurant_name, tagline) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, 'Main Menu', slug, restaurant_name || name, 'Delicious food served fresh');
    const menuId = menuResult.lastInsertRowid;
    const ins = db.prepare('INSERT INTO sections (menu_id, name, sort_order) VALUES (?, ?, ?)');
    ins.run(menuId, 'Starters', 0);
    ins.run(menuId, 'Mains', 1);
    ins.run(menuId, 'Breads', 2);
    ins.run(menuId, 'Drinks', 3);

    // Send emails (fire-and-forget — don't block the response)
    const menuUrl = `${process.env.FRONTEND_URL || ''}/menu/${slug}`;
    sendVerificationEmail(email, name, verifyToken).catch(() => {});
    sendWelcomeEmail(email, name, menuUrl).catch(() => {});

    res.status(201).json({ user: safeUser({ ...user, email_verified: 0, plan: 'free' }), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ user: safeUser(user), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── GET /api/auth/verify-email?token=... ─────────────────────────────────────
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email_verify_token = ?').get(token);
    if (!user) return res.status(400).json({ error: 'Invalid or already-used verification link.' });

    db.prepare(
      'UPDATE users SET email_verified = 1, email_verify_token = NULL WHERE id = ?'
    ).run(user.id);

    res.json({ success: true, message: 'Email verified! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', authMiddleware, async (req, res) => {
  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Email is already verified.' });

    const token = randomToken();
    db.prepare('UPDATE users SET email_verify_token = ? WHERE id = ?').run(token, user.id);
    await sendVerificationEmail(user.email, user.name, token).catch(e =>
      console.error('[authRoutes] resend-verification email failed:', e.message)
    );
    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Always respond the same way to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(
      token, expires, user.id
    );

    await sendPasswordResetEmail(user.email, token).catch(e =>
      console.error('[authRoutes] forgot-password email failed:', e.message)
    );
    // Always return success — never reveal whether email was sent or not
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (new Date(user.reset_token_expires) < new Date())
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const hashed = bcrypt.hashSync(password, 10);
    db.prepare(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
    ).run(hashed, user.id);

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', authMiddleware, (req, res) => {
  const { name, restaurant_name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  try {
    db.prepare('UPDATE users SET name = ?, restaurant_name = ? WHERE id = ?').run(
      name.trim(), (restaurant_name || '').trim(), req.user.id
    );
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', authMiddleware, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'Both fields are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user || !bcrypt.compareSync(old_password, user.password))
      return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
