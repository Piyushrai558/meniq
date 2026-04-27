const express = require('express');
const multer  = require('multer');
const { query } = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Direct REST call — avoids SDK version/model-name issues
async function callGemini(base64, mimeType) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  // Try models in order until one works
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision'];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{
        parts: [
          { text: SCAN_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 404) continue; // try next model

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      throw new Error(msg);
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  throw new Error('No Gemini model available. Check your GOOGLE_AI_KEY at aistudio.google.com/app/apikey');
}

const SCAN_PROMPT = `You are a menu digitization assistant. Analyze this restaurant menu image carefully.

Extract every section and every item visible. Return ONLY valid JSON — no markdown, no explanation, nothing else.

Output format:
{
  "restaurant_name": "name from menu header, or empty string if not visible",
  "sections": [
    {
      "name": "Section name (e.g. Starters, Mains, Breads, Desserts, Drinks)",
      "items": [
        {
          "name": "Exact item name",
          "price": 150,
          "description": "brief description if printed on menu, else empty string",
          "type": "veg",
          "emoji": "🥗"
        }
      ]
    }
  ]
}

Rules:
- "type" must be exactly one of: "veg", "nonveg", "egg"
- Infer type from green/red dot symbols common on Indian menus, or item name
- "price" is a plain number (no currency symbol). If menu shows Half/Full prices, use the Full price. Use 0 if not readable
- Pick a fitting food emoji for each item
- If items have no section headers, group them logically (Starters, Mains, Drinks, etc.)
- Preserve original item names exactly as printed
- Return ONLY the JSON object, nothing else`;

// ── POST /api/ai/scan-menu ────────────────────────────────────────────────────
router.post('/scan-menu', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image file is required' });

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey || apiKey.includes('PASTE') || apiKey.length < 10) {
    return res.status(503).json({
      error: 'AI scanning not configured. Add GOOGLE_AI_KEY in Railway variables. Get a free key at aistudio.google.com/app/apikey',
    });
  }

  try {
    const base64   = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const text = await callGemini(base64, mimeType);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({
        error: 'Could not read menu from this image. Try a clearer photo with better lighting.',
      });
    }

    const menuData = JSON.parse(jsonMatch[0]);

    if (!menuData.sections || !Array.isArray(menuData.sections)) {
      return res.status(422).json({ error: 'No menu sections found. Please try a clearer photo.' });
    }

    menuData.sections = menuData.sections.map(s => ({
      name:  s.name  || 'Menu',
      items: (s.items || []).map(item => ({
        name:        item.name        || 'Item',
        price:       Number(item.price) || 0,
        description: item.description || '',
        type:        ['veg','nonveg','egg'].includes(item.type) ? item.type : 'veg',
        emoji:       item.emoji       || '🍽',
      })),
    }));

    res.json({ menu: menuData });
  } catch (err) {
    console.error('[aiRoutes] scan-menu error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'Could not parse menu data. Try a clearer photo.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/create-from-scan ─────────────────────────────────────────────
router.post('/create-from-scan', authMiddleware, async (req, res) => {
  const { menu_name, restaurant_name, sections } = req.body;
  if (!menu_name || !sections || !Array.isArray(sections))
    return res.status(400).json({ error: 'menu_name and sections are required' });

  const planResult = await query('SELECT plan, plan_expires_at FROM users WHERE id = $1', [req.user.id]);
  const u = planResult.rows[0];
  const plan = (!u || !u.plan || u.plan === 'free' ||
    (u.plan_expires_at && new Date(u.plan_expires_at) < new Date())) ? 'free' : u.plan;

  const PLAN_LIMITS = { free: 1, basic: 3, pro: Infinity };
  const limit = PLAN_LIMITS[plan] ?? 1;
  const countResult = await query('SELECT COUNT(*) as c FROM menus WHERE user_id = $1', [req.user.id]);
  const count = parseInt(countResult.rows[0].c);

  if (count >= limit) {
    return res.status(403).json({
      error: `Your ${plan} plan allows ${limit} menu${limit > 1 ? 's' : ''}. Upgrade to create more.`,
      upgrade_required: true,
    });
  }

  try {
    const slug =
      (restaurant_name || menu_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
      '-' + Date.now();

    const menuResult = await query(
      'INSERT INTO menus (user_id, name, slug, restaurant_name) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, menu_name, slug, restaurant_name || '']
    );
    const menuId = menuResult.rows[0].id;

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const secResult = await query(
        'INSERT INTO sections (menu_id, name, sort_order) VALUES ($1,$2,$3) RETURNING id',
        [menuId, sec.name, si]
      );
      const sectionId = secResult.rows[0].id;

      for (let ii = 0; ii < (sec.items || []).length; ii++) {
        const item = sec.items[ii];
        await query(
          'INSERT INTO items (section_id, name, price, description, type, emoji, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [sectionId, item.name, item.price || 0, item.description || '', item.type || 'veg', item.emoji || '🍽', ii]
        );
      }
    }

    const newMenu = await query('SELECT * FROM menus WHERE id = $1', [menuId]);
    res.status(201).json({ menu: newMenu.rows[0] });
  } catch (err) {
    console.error('[aiRoutes] create-from-scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
