require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb, initDb } = require('./database');

initDb();
const db = getDb();

const password = bcrypt.hashSync('demo123', 10);
const userResult = db.prepare('INSERT OR IGNORE INTO users (email, password, name, restaurant_name) VALUES (?, ?, ?, ?)').run('demo@spicegarden.com', password, 'Rajesh Sharma', 'Spice Garden');
const userId = userResult.lastInsertRowid || db.prepare('SELECT id FROM users WHERE email = ?').get('demo@spicegarden.com').id;

const menuResult = db.prepare('INSERT INTO menus (user_id, name, slug, restaurant_name, tagline, accent_color, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, 'Main Menu', 'spice-garden', 'Spice Garden', 'Authentic Indian cuisine since 1995', '#C8622A', 'Lucknow, UP · Hazratganj');
const menuId = menuResult.lastInsertRowid;

const ins = db.prepare('INSERT INTO sections (menu_id, name, sort_order) VALUES (?, ?, ?)');
const s1 = ins.run(menuId, 'Starters', 0).lastInsertRowid;
const s2 = ins.run(menuId, 'Mains', 1).lastInsertRowid;
const s3 = ins.run(menuId, 'Breads', 2).lastInsertRowid;
const s4 = ins.run(menuId, 'Drinks', 3).lastInsertRowid;

const ii = db.prepare('INSERT INTO items (section_id, name, price, description, type, emoji, is_active, is_bestseller, is_spicy, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
ii.run(s1, 'Paneer Tikka', 220, 'Marinated cottage cheese grilled in tandoor with peppers and onions', 'veg', '🧀', 1, 0, 1, 0);
ii.run(s1, 'Chicken 65', 280, 'Crispy deep-fried chicken with South Indian spices, curry leaves', 'nonveg', '🍗', 1, 0, 1, 1);
ii.run(s1, 'Hara Bhara Kabab', 180, 'Spinach and pea patties with herbs', 'veg', '🥦', 1, 0, 0, 2);
ii.run(s1, 'Mutton Seekh Kebab', 320, 'Minced mutton on skewers, flame-grilled', 'nonveg', '🍖', 0, 0, 1, 3);
ii.run(s1, 'Veg Spring Roll', 160, 'Crispy golden rolls with vegetable filling', 'veg', '🥗', 1, 0, 0, 4);

ii.run(s2, 'Dal Makhani', 320, 'Slow-cooked black lentils with butter and cream', 'veg', '🫕', 1, 1, 0, 0);
ii.run(s2, 'Butter Chicken', 380, 'Tender chicken in tomato-cream gravy', 'nonveg', '🍗', 1, 1, 0, 1);
ii.run(s2, 'Palak Paneer', 340, 'Fresh spinach with cottage cheese', 'veg', '🥬', 1, 0, 0, 2);
ii.run(s2, 'Biryani (Chicken)', 350, 'Lucknowi dum biryani with aromatic spices', 'nonveg', '🍚', 1, 1, 1, 3);
ii.run(s2, 'Shahi Paneer', 300, 'Rich cashew and tomato gravy with paneer cubes', 'veg', '🧀', 1, 0, 0, 4);
ii.run(s2, 'Rogan Josh', 400, 'Kashmiri style slow-cooked lamb curry', 'nonveg', '🍖', 1, 0, 1, 5);
ii.run(s2, 'Chole Bhature', 250, 'Spiced chickpeas with fluffy fried bread', 'veg', '🫘', 1, 0, 0, 6);
ii.run(s2, 'Kadai Chicken', 360, 'Chicken cooked with bell peppers in kadai masala', 'nonveg', '🍗', 1, 0, 1, 7);

ii.run(s3, 'Butter Naan', 60, 'Tandoor-baked bread with butter', 'veg', '🫓', 1, 0, 0, 0);
ii.run(s3, 'Garlic Naan', 70, 'Tandoor-baked bread with fresh garlic and coriander', 'veg', '🧄', 1, 0, 0, 1);
ii.run(s3, 'Laccha Paratha', 80, 'Layered whole wheat flaky bread', 'veg', '🫓', 1, 0, 0, 2);
ii.run(s3, 'Tandoori Roti', 40, 'Whole wheat bread baked in tandoor', 'veg', '🫓', 1, 0, 0, 3);

ii.run(s4, 'Mango Lassi', 120, 'Thick Alphonso mango blended with yoghurt and cardamom', 'veg', '🥭', 1, 0, 0, 0);
ii.run(s4, 'Rose Sharbat', 80, 'Chilled rose syrup with basil seeds', 'veg', '🌹', 1, 0, 0, 1);
ii.run(s4, 'Masala Chai', 50, 'Ginger cardamom tea brewed with milk', 'veg', '☕', 1, 0, 0, 2);
ii.run(s4, 'Fresh Lime Soda', 70, 'Fresh lime juice with soda, salt or sweet', 'veg', '🍋', 1, 0, 0, 3);
ii.run(s4, 'Thandai', 100, 'Lucknowi chilled almond-saffron milk drink', 'veg', '🥛', 1, 0, 0, 4);

const ia = db.prepare('INSERT INTO analytics (menu_id, event_type, ip_address, created_at) VALUES (?, ?, ?, ?)');
const now = new Date();
for (let i = 0; i < 30; i++) {
  const d = new Date(now); d.setDate(d.getDate() - i);
  const views = Math.floor(Math.random() * 80) + 20;
  for (let j = 0; j < views; j++) ia.run(menuId, 'menu_view', '127.0.0.1', d.toISOString());
}

db.close();
console.log('✅ Database seeded');
console.log('   Login: demo@spicegarden.com / demo123');
console.log('   Public menu: http://localhost:3000/menu/spice-garden');
