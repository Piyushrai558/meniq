const express = require('express');
const { query } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const FREE_ITEM_LIMIT = 15;

async function getUserPlan(userId) {
  const result = await query('SELECT plan, plan_expires_at FROM users WHERE id = $1', [userId]);
  const u = result.rows[0];
  if (!u || !u.plan || u.plan === 'free') return 'free';
  if (u.plan_expires_at && new Date(u.plan_expires_at) < new Date()) return 'free';
  return u.plan;
}

router.post('/', authMiddleware, async (req, res) => {
  const { menu_id, name } = req.body;
  if (!menu_id || !name) return res.status(400).json({ error: 'menu_id and name required' });
  try {
    const menuResult = await query('SELECT * FROM menus WHERE id = $1 AND user_id = $2', [menu_id, req.user.id]);
    if (!menuResult.rows[0]) return res.status(404).json({ error: 'Menu not found' });

    const maxResult = await query('SELECT MAX(sort_order) as m FROM sections WHERE menu_id = $1', [menu_id]);
    const maxOrder = maxResult.rows[0].m || 0;

    const result = await query(
      'INSERT INTO sections (menu_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
      [menu_id, name, maxOrder + 1]
    );
    const section = await query('SELECT * FROM sections WHERE id = $1', [result.rows[0].id]);
    res.status(201).json({ section: section.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const sectionResult = await query(
      'SELECT s.* FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = $1 AND m.user_id = $2',
      [req.params.id, req.user.id]
    );
    const section = sectionResult.rows[0];
    if (!section) return res.status(404).json({ error: 'Section not found' });

    await query('UPDATE sections SET name=$1, sort_order=$2 WHERE id=$3', [
      name || section.name,
      sort_order ?? section.sort_order,
      section.id,
    ]);
    const updated = await query('SELECT * FROM sections WHERE id = $1', [section.id]);
    res.json({ section: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const sectionResult = await query(
      'SELECT s.* FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = $1 AND m.user_id = $2',
      [req.params.id, req.user.id]
    );
    const section = sectionResult.rows[0];
    if (!section) return res.status(404).json({ error: 'Section not found' });

    await query('DELETE FROM sections WHERE id = $1', [section.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Items ─────────────────────────────────────────────────────────────────────
router.post('/items', authMiddleware, async (req, res) => {
  const { section_id, name, price, description, type, emoji, is_bestseller, is_spicy, image_url } = req.body;
  if (!section_id || !name) return res.status(400).json({ error: 'section_id and name required' });

  try {
    const sectionResult = await query(
      'SELECT s.*, m.id as menu_id FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = $1 AND m.user_id = $2',
      [section_id, req.user.id]
    );
    const section = sectionResult.rows[0];
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const plan = await getUserPlan(req.user.id);
    if (plan === 'free') {
      const totalResult = await query(
        'SELECT COUNT(*) as c FROM items i JOIN sections s ON i.section_id = s.id WHERE s.menu_id = $1',
        [section.menu_id]
      );
      const totalItems = parseInt(totalResult.rows[0].c);
      if (totalItems >= FREE_ITEM_LIMIT) {
        return res.status(403).json({
          error: `Free plan allows up to ${FREE_ITEM_LIMIT} items per menu. Upgrade to add more.`,
          upgrade_required: true,
        });
      }
    }

    const maxResult = await query('SELECT MAX(sort_order) as m FROM items WHERE section_id = $1', [section_id]);
    const maxOrder = maxResult.rows[0].m || 0;

    const result = await query(
      'INSERT INTO items (section_id, name, price, description, type, emoji, image_url, is_bestseller, is_spicy, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [
        section_id, name, price || 0, description || '',
        type || 'veg', emoji || (type === 'nonveg' ? '🍗' : '🥦'),
        image_url || '',
        is_bestseller ? 1 : 0, is_spicy ? 1 : 0, maxOrder + 1,
      ]
    );
    const item = await query('SELECT * FROM items WHERE id = $1', [result.rows[0].id]);
    await query('UPDATE menus SET updated_at = NOW() WHERE id = $1', [section.menu_id]);
    res.status(201).json({ item: item.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/items/:id', authMiddleware, async (req, res) => {
  const { name, price, description, type, emoji, image_url, is_active, is_bestseller, is_spicy, sort_order } = req.body;
  try {
    const itemResult = await query(
      'SELECT i.* FROM items i JOIN sections s ON i.section_id = s.id JOIN menus m ON s.menu_id = m.id WHERE i.id = $1 AND m.user_id = $2',
      [req.params.id, req.user.id]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await query(
      'UPDATE items SET name=$1, price=$2, description=$3, type=$4, emoji=$5, image_url=$6, is_active=$7, is_bestseller=$8, is_spicy=$9, sort_order=$10 WHERE id=$11',
      [
        name || item.name,
        price ?? item.price,
        description ?? item.description,
        type || item.type,
        emoji || item.emoji,
        image_url !== undefined ? image_url : item.image_url,
        is_active !== undefined ? (is_active ? 1 : 0) : item.is_active,
        is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : item.is_bestseller,
        is_spicy !== undefined ? (is_spicy ? 1 : 0) : item.is_spicy,
        sort_order ?? item.sort_order,
        item.id,
      ]
    );
    const updated = await query('SELECT * FROM items WHERE id = $1', [item.id]);
    res.json({ item: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/items/:id', authMiddleware, async (req, res) => {
  try {
    const itemResult = await query(
      'SELECT i.* FROM items i JOIN sections s ON i.section_id = s.id JOIN menus m ON s.menu_id = m.id WHERE i.id = $1 AND m.user_id = $2',
      [req.params.id, req.user.id]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await query('DELETE FROM items WHERE id = $1', [item.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
