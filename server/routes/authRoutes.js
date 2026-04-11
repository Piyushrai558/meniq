const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { generateToken, authMiddleware } = require('../auth');

const router = express.Router();

router.post('/signup', (req, res) => {
  const { email, password, name, restaurant_name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name are required' });

  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (email, password, name, restaurant_name) VALUES (?, ?, ?, ?)').run(email, hashed, name, restaurant_name || '');
    const user = { id: result.lastInsertRowid, email, name, restaurant_name: restaurant_name || '' };
    const token = generateToken(user);

    const slug = (restaurant_name || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const menuResult = db.prepare('INSERT INTO menus (user_id, name, slug, restaurant_name, tagline) VALUES (?, ?, ?, ?, ?)').run(user.id, 'Main Menu', slug, restaurant_name || name, 'Delicious food served fresh');
    const menuId = menuResult.lastInsertRowid;
    const ins = db.prepare('INSERT INTO sections (menu_id, name, sort_order) VALUES (?, ?, ?)');
    ins.run(menuId, 'Starters', 0);
    ins.run(menuId, 'Mains', 1);
    ins.run(menuId, 'Breads', 2);
    ins.run(menuId, 'Drinks', 3);

    res.status(201).json({ user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
    const token = generateToken(user);
    res.json({ user: { id: user.id, email: user.email, name: user.name, restaurant_name: user.restaurant_name }, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const user = db.prepare('SELECT id, email, name, restaurant_name, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

module.exports = router;
