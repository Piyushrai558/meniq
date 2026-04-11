const express = require('express');
const QRCode = require('qrcode');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

router.get('/menu/:slug', (req, res) => {
  const db = getDb();
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE slug = ? AND is_active = 1').get(req.params.slug);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    const sections = db.prepare('SELECT * FROM sections WHERE menu_id = ? ORDER BY sort_order').all(menu.id);
    for (const s of sections) s.items = db.prepare('SELECT * FROM items WHERE section_id = ? AND is_active = 1 ORDER BY sort_order').all(s.id);
    menu.sections = sections;
    db.prepare('INSERT INTO analytics (menu_id, event_type, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(menu.id, 'menu_view', req.ip, req.get('user-agent'));
    res.json({ menu });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

router.get('/qr/:slug', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const menuUrl = `${baseUrl}/menu/${req.params.slug}`;
    const qrDataUrl = await QRCode.toDataURL(menuUrl, { width: 300, margin: 2, color: { dark: '#1A1410', light: '#FFFDF9' } });
    res.json({ qr: qrDataUrl, url: menuUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/:menuId', authMiddleware, (req, res) => {
  const db = getDb();
  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ? AND user_id = ?').get(req.params.menuId, req.user.id);
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    const today = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE menu_id = ? AND event_type = 'menu_view' AND date(created_at) = date('now')").get(menu.id);
    const week = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE menu_id = ? AND event_type = 'menu_view' AND created_at >= datetime('now', '-7 days')").get(menu.id);
    const total = db.prepare("SELECT COUNT(*) as count FROM analytics WHERE menu_id = ? AND event_type = 'menu_view'").get(menu.id);
    const daily = db.prepare("SELECT date(created_at) as date, COUNT(*) as views FROM analytics WHERE menu_id = ? AND event_type = 'menu_view' AND created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY date").all(menu.id);
    res.json({ views_today: today.count, views_this_week: week.count, views_total: total.count, daily_views: daily });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { db.close(); }
});

module.exports = router;
