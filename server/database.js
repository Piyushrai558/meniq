const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './db/menuify.db';

function getDb() {
  const fullPath = path.resolve(__dirname, '..', DB_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const db = new Database(fullPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      restaurant_name TEXT DEFAULT '',
      email_verified INTEGER DEFAULT 0,
      email_verify_token TEXT,
      plan TEXT DEFAULT 'free',
      plan_expires_at DATETIME,
      reset_token TEXT,
      reset_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      restaurant_name TEXT DEFAULT '',
      tagline TEXT DEFAULT '',
      accent_color TEXT DEFAULT '#C8622A',
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'veg',
      emoji TEXT DEFAULT '🥦',
      image_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      is_bestseller INTEGER DEFAULT 0,
      is_spicy INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      item_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for existing databases (ignore errors if column already exists)
  const migrations = [
    'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN email_verify_token TEXT',
    'ALTER TABLE users ADD COLUMN plan TEXT DEFAULT \'free\'',
    'ALTER TABLE users ADD COLUMN plan_expires_at DATETIME',
    'ALTER TABLE users ADD COLUMN reset_token TEXT',
    'ALTER TABLE users ADD COLUMN reset_token_expires DATETIME',
    'ALTER TABLE items ADD COLUMN image_url TEXT DEFAULT \'\'',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists – skip */ }
  }

  db.close();
  console.log('✅ Database initialized');
}

module.exports = { getDb, initDb };
