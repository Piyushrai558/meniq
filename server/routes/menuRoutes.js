const express = require('express');
const { query } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const PLAN_LIMITS = { free: 1, basic: 3, pro: Infinity };

async function getUserPlan(userId) {
  const result = await query('SELECT plan, plan_expires_at FROM users WHERE id = $1', [userId]);
  const u = result.rows[0];
  if (!u || !u.plan || u.plan === 'free') return 'free';
  if (u.plan_expires_at && new Date(u.plan_expires_at) < new Date()) return 'free';
  return u.plan;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*,
        (SELECT COUNT(*) FROM sections s WHERE s.menu_id = m.id) as section_count,
        (SELECT COUNT(*) FROM items i JOIN sections s ON i.section_id = s.id WHERE s.menu_id = m.id) as item_count
      FROM menus m WHERE m.user_id = $1 ORDER BY m.created_at DESC
    `, [req.user.id]);
    res.json({ menus: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  const { name, restaurant_name, tagline, accent_color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Menu name is required' });

  try {
    const plan = await getUserPlan(req.user.id);
    const limit = PLAN_LIMITS[plan] ?? 1;
    const countResult = await query('SELECT COUNT(*) as c FROM menus WHERE user_id = $1', [req.user.id]);
    const count = parseInt(countResult.rows[0].c);

    if (count >= limit) {
      return res.status(403).json({
        error: `Your ${plan} plan allows ${limit} menu${limit > 1 ? 's' : ''}. Upgrade to create more.`,
        upgrade_required: true,
      });
    }

    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const result = await query(
      'INSERT INTO menus (user_id, name, slug, restaurant_name, tagline, accent_color, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [req.user.id, name, slug, restaurant_name || '', tagline || '', accent_color || '#C8622A', description || '']
    );
    const menuResult = await query('SELECT * FROM menus WHERE id = $1', [result.rows[0].id]);
    res.status(201).json({ menu: menuResult.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const menuResult = await query('SELECT * FROM menus WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const menu = menuResult.rows[0];
    if (!menu) return res.status(404).json({ error: 'Menu not found' });

    const sectionsResult = await query('SELECT * FROM sections WHERE menu_id = $1 ORDER BY sort_order', [menu.id]);
    const sections = sectionsResult.rows;
    for (const s of sections) {
      const itemsResult = await query('SELECT * FROM items WHERE section_id = $1 ORDER BY sort_order', [s.id]);
      s.items = itemsResult.rows;
    }
    menu.sections = sections;
    res.json({ menu });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { name, restaurant_name, tagline, accent_color, description } = req.body;
  try {
    const menuResult = await query('SELECT * FROM menus WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const menu = menuResult.rows[0];
    if (!menu) return res.status(404).json({ error: 'Menu not found' });

    await query(
      'UPDATE menus SET name=$1, restaurant_name=$2, tagline=$3, accent_color=$4, description=$5, updated_at=NOW() WHERE id=$6',
      [name || menu.name, restaurant_name ?? menu.restaurant_name, tagline ?? menu.tagline, accent_color || menu.accent_color, description ?? menu.description, menu.id]
    );
    const updated = await query('SELECT * FROM menus WHERE id = $1', [menu.id]);
    res.json({ menu: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query('DELETE FROM menus WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Menu not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
