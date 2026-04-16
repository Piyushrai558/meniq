const express = require('express');
const QRCode = require('qrcode');
const os = require('os');
const { getDb } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Returns the best base URL for QR codes.
// - If BASE_URL is set in .env, use that (works for any deployment).
// - If the request came in on localhost (dev), swap to the machine's LAN IP
//   so phones on the same Wi-Fi can actually open the link.
// - Otherwise (production with a real domain) use the Host header as-is.
function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');

  const host = req.get('host') || '';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (isLocal) {
    const port = host.split(':')[1] || '3000';
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return `${req.protocol}://${iface.address}:${port}`;
        }
      }
    }
  }

  return `${req.protocol}://${host}`;
}

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
    const menuUrl = `${getBaseUrl(req)}/menu/${req.params.slug}`;
    const size = Math.min(Math.max(parseInt(req.query.size) || 300, 100), 1000);
    const dark = `#${(req.query.dark || '1A1410').replace('#', '')}`;
    const light = `#${(req.query.light || 'FFFDF9').replace('#', '')}`;
    const qrDataUrl = await QRCode.toDataURL(menuUrl, { width: size, margin: 2, color: { dark, light } });
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
