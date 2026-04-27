const express = require('express');
const QRCode = require('qrcode');
const os = require('os');
const { query } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

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

router.get('/menu/:slug', async (req, res) => {
  try {
    const menuResult = await query('SELECT * FROM menus WHERE slug = $1 AND is_active = 1', [req.params.slug]);
    const menu = menuResult.rows[0];
    if (!menu) return res.status(404).json({ error: 'Menu not found' });

    const sectionsResult = await query('SELECT * FROM sections WHERE menu_id = $1 ORDER BY sort_order', [menu.id]);
    const sections = sectionsResult.rows;
    for (const s of sections) {
      const itemsResult = await query('SELECT * FROM items WHERE section_id = $1 AND is_active = 1 ORDER BY sort_order', [s.id]);
      s.items = itemsResult.rows;
    }
    menu.sections = sections;

    await query(
      'INSERT INTO analytics (menu_id, event_type, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [menu.id, 'menu_view', req.ip, req.get('user-agent')]
    );

    res.json({ menu });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

router.get('/analytics/:menuId', authMiddleware, async (req, res) => {
  try {
    const menuResult = await query('SELECT * FROM menus WHERE id = $1 AND user_id = $2', [req.params.menuId, req.user.id]);
    const menu = menuResult.rows[0];
    if (!menu) return res.status(404).json({ error: 'Menu not found' });

    const today = await query(
      "SELECT COUNT(*) as count FROM analytics WHERE menu_id = $1 AND event_type = 'menu_view' AND created_at::date = CURRENT_DATE",
      [menu.id]
    );
    const week = await query(
      "SELECT COUNT(*) as count FROM analytics WHERE menu_id = $1 AND event_type = 'menu_view' AND created_at >= NOW() - INTERVAL '7 days'",
      [menu.id]
    );
    const total = await query(
      "SELECT COUNT(*) as count FROM analytics WHERE menu_id = $1 AND event_type = 'menu_view'",
      [menu.id]
    );
    const daily = await query(
      "SELECT created_at::date as date, COUNT(*) as views FROM analytics WHERE menu_id = $1 AND event_type = 'menu_view' AND created_at >= NOW() - INTERVAL '30 days' GROUP BY created_at::date ORDER BY date",
      [menu.id]
    );

    res.json({
      views_today: parseInt(today.rows[0].count),
      views_this_week: parseInt(week.rows[0].count),
      views_total: parseInt(total.rows[0].count),
      daily_views: daily.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
