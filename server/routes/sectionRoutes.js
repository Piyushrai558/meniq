const express = require('express');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  const { menu_id, name } = req.body;
  if (!menu_id || !name) return res.status(400).json({ error: 'menu_id and name required' });
  const db = getDb();
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ? AND user_id = ?').get(menu_id, req.user.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    const max = db.prepare('SELECT MAX(sort_order) as m FROM sections WHERE menu_id = ?').get(menu_id);
    const result = db.prepare('INSERT INTO sections (menu_id, name, sort_order) VALUES (?, ?, ?)').run(menu_id, name, (max.m || 0) + 1);
    const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ section });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.put('/:id', authMiddleware, (req, res) => {
  const { name, sort_order } = req.body;
  const db = getDb();
  try {
    const section = db.prepare('SELECT s.* FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = ? AND m.user_id = ?').get(req.params.id, req.user.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    db.prepare('UPDATE sections SET name=?, sort_order=? WHERE id=?').run(name || section.name, sort_order ?? section.sort_order, section.id);
    const updated = db.prepare('SELECT * FROM sections WHERE id = ?').get(section.id);
    res.json({ section: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const section = db.prepare('SELECT s.* FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = ? AND m.user_id = ?').get(req.params.id, req.user.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    db.prepare('DELETE FROM sections WHERE  id = ?').run(section.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

// Items
router.post('/items', authMiddleware, (req, res) => {
  const { section_id, name, price, description, type, emoji, is_bestseller, is_spicy } = req.body;
  if (!section_id || !name) return res.status(400).json({ error: 'section_id and name required' });
  const db = getDb();
  try {
    const section = db.prepare('SELECT s.* FROM sections s JOIN menus m ON s.menu_id = m.id WHERE s.id = ? AND m.user_id = ?').get(section_id, req.user.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    const max = db.prepare('SELECT MAX(sort_order) as m FROM items WHERE section_id = ?').get(section_id);
    const result = db.prepare('INSERT INTO items (section_id, name, price, description, type, emoji, is_bestseller, is_spicy, sort_order) VALUES (?,?,?,?,?,?,?,?,?)').run(section_id, name, price || 0, description || '', type || 'veg', emoji || (type === 'nonveg' ? '🍗' : '🥦'), is_bestseller ? 1 : 0, is_spicy ? 1 : 0, (max.m || 0) + 1);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    db.prepare('UPDATE menus SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(section.menu_id);
    res.status(201).json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.put('/items/:id', authMiddleware, (req, res) => {
  const { name, price, description, type, emoji, is_active, is_bestseller, is_spicy, sort_order } = req.body;
  const db = getDb();
  try {
    const item = db.prepare('SELECT i.* FROM items i JOIN sections s ON i.section_id = s.id JOIN menus m ON s.menu_id = m.id WHERE i.id = ? AND m.user_id = ?').get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    db.prepare('UPDATE items SET name=?, price=?, description=?, type=?, emoji=?, is_active=?, is_bestseller=?, is_spicy=?, sort_order=? WHERE id=?').run(
      name || item.name, price ?? item.price, description ?? item.description, type || item.type, emoji || item.emoji,
      is_active !== undefined ? (is_active ? 1 : 0) : item.is_active,
      is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : item.is_bestseller,
      is_spicy !== undefined ? (is_spicy ? 1 : 0) : item.is_spicy,
      sort_order ?? item.sort_order, item.id
    );
    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
    res.json({ item: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.delete('/items/:id', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const item = db.prepare('SELECT i.* FROM items i JOIN sections s ON i.section_id = s.id JOIN menus m ON s.menu_id = m.id WHERE i.id = ? AND m.user_id = ?').get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

module.exports = router;
