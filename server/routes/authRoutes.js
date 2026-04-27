const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../database');
const { generateToken, authMiddleware } = require('../auth');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../mailer');

const router = express.Router();

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

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const verifyToken = randomToken();

    const result = await query(
      'INSERT INTO users (email, password, name, restaurant_name, email_verify_token) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [email, hashed, name, restaurant_name || '', verifyToken]
    );
    const userId = result.rows[0].id;
    const user = { id: userId, email, name, restaurant_name: restaurant_name || '' };
    const token = generateToken(user);

    // Create a starter menu
    const slug =
      (restaurant_name || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' + Date.now();
    const menuResult = await query(
      'INSERT INTO menus (user_id, name, slug, restaurant_name, tagline) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, 'Main Menu', slug, restaurant_name || name, 'Delicious food served fresh']
    );
    const menuId = menuResult.rows[0].id;
    await query('INSERT INTO sections (menu_id, name, sort_order) VALUES ($1, $2, $3)', [menuId, 'Starters', 0]);
    await query('INSERT INTO sections (menu_id, name, sort_order) VALUES ($1, $2, $3)', [menuId, 'Mains', 1]);
    await query('INSERT INTO sections (menu_id, name, sort_order) VALUES ($1, $2, $3)', [menuId, 'Breads', 2]);
    await query('INSERT INTO sections (menu_id, name, sort_order) VALUES ($1, $2, $3)', [menuId, 'Drinks', 3]);

    const menuUrl = `${process.env.FRONTEND_URL || ''}/menu/${slug}`;
    sendVerificationEmail(email, name, verifyToken).catch(() => {});
    sendWelcomeEmail(email, name, menuUrl).catch(() => {});

    res.status(201).json({ user: safeUser({ ...user, email_verified: 0, plan: 'free' }), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ user: safeUser(user), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/verify-email?token=... ─────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const result = await query('SELECT * FROM users WHERE email_verify_token = $1', [token]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already-used verification link.' });

    await query('UPDATE users SET email_verified = 1, email_verify_token = NULL WHERE id = $1', [user.id]);
    res.json({ success: true, message: 'Email verified! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Email is already verified.' });

    const token = randomToken();
    await query('UPDATE users SET email_verify_token = $1 WHERE id = $2', [token, user.id]);
    await sendVerificationEmail(user.email, user.name, token).catch(e =>
      console.error('[authRoutes] resend-verification email failed:', e.message)
    );
    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, user.id]);

    await sendPasswordResetEmail(user.email, token).catch(e =>
      console.error('[authRoutes] forgot-password email failed:', e.message)
    );
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const result = await query('SELECT * FROM users WHERE reset_token = $1', [token]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (new Date(user.reset_token_expires) < new Date())
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const hashed = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [hashed, user.id]);
    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, restaurant_name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  try {
    await query('UPDATE users SET name = $1, restaurant_name = $2 WHERE id = $3', [name.trim(), (restaurant_name || '').trim(), req.user.id]);
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: safeUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put('/change-password', authMiddleware, async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'Both fields are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(old_password, user.password)))
      return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
