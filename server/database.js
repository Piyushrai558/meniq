const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Simple query helper
async function query(sql, params) {
  return pool.query(sql, params);
}

async function initDb() {
  // Test connection first — gives a clear error if DATABASE_URL is wrong
  await pool.query('SELECT 1');
  console.log('✅ PostgreSQL connection OK');

  // Run each table creation separately so failures are easy to diagnose
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      restaurant_name TEXT DEFAULT '',
      email_verified INTEGER DEFAULT 0,
      email_verify_token TEXT,
      plan TEXT DEFAULT 'free',
      plan_expires_at TIMESTAMP,
      reset_token TEXT,
      reset_token_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      restaurant_name TEXT DEFAULT '',
      tagline TEXT DEFAULT '',
      accent_color TEXT DEFAULT '#C8622A',
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
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
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      item_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('✅ All tables ready');
}

module.exports = { query, initDb, pool };
