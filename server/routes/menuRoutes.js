const express = require('express');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const PLAN_LIMITS = { free: 1, basic: 3, pro: Infinity };

function getUserPlan(db, userId) {
  const u = db.prepare('SELECT plan, plan_expires_at FROM users WHERE id = ?').get(userId);
  if (!u || !u.plan || u.plan === 'free') return 'free';
  if (u.plan_expires_at && new Date(u.plan_expires_at) < new Date()) return 'free';
  return u.plan;
}

router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const menus = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM sections s WHERE s.menu_id = m.id) as section_count,
        (SELECT COUNT(*) FROM items i JOIN sections s ON i.section_id = s.id WHERE s.menu_id = m.id) as item_count
      FROM menus m WHERE m.user_id = ? ORDER BY m.created_at DESC
    `).all(req.user.id);
    res.json({ menus });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.post('/', authMiddleware, (req, res) => {
  const { name, restaurant_name, tagline, accent_color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Menu name is required' });

  const db = getDb();
  try {
    const plan = getUserPlan(db, req.user.id);
    const limit = PLAN_LIMITS[plan] ?? 1;
    const count = db.prepare('SELECT COUNT(*) as c FROM menus WHERE user_id = ?').get(req.user.id).c;

    if (count >= limit) {
      return res.status(403).json({
        error: `Your ${plan} plan allows ${limit} menu${limit > 1 ? 's' : ''}. Upgrade to create more.`,
        upgrade_required: true,
      });
    }

    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const result = db.prepare(
      'INSERT INTO menus (user_id, name, slug, restaurant_name, tagline, accent_color, description) VALUES (?,?,?,?,?,?,?)'
    ).run(req.user.id, name, slug, restaurant_name || '', tagline || '', accent_color || '#C8622A', description || '');
    const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ menu });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    const sections = db.prepare('SELECT * FROM sections WHERE menu_id = ? ORDER BY sort_order').all(menu.id);
    for (const s of sections) s.items = db.prepare('SELECT * FROM items WHERE section_id = ? ORDER BY sort_order').all(s.id);
    menu.sections = sections;
    res.json({ menu });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.put('/:id', authMiddleware, (req, res) => {
  const { name, restaurant_name, tagline, accent_color, description } = req.body;
  const db = getDb();
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    db.prepare(
      'UPDATE menus SET name=?, restaurant_name=?, tagline=?, accent_color=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name || menu.name, restaurant_name ?? menu.restaurant_name, tagline ?? menu.tagline, accent_color || menu.accent_color, description ?? menu.description, menu.id);
    const updated = db.prepare('SELECT * FROM menus WHERE id = ?').get(menu.id);
    res.json({ menu: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM menus WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Menu not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

module.exports = router;
