const path = require('path');

// Load the right .env file based on NODE_ENV
// Local dev  → .env          (NODE_ENV not set or 'development')
// Production → .env.production (NODE_ENV=production set by Railway/server)
// On Railway the file won't exist — that's fine, Railway injects vars directly.
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

const express = require('express');
const cors    = require('cors');
const { initDb } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/menus',    require('./routes/menuRoutes'));
app.use('/api/sections', require('./routes/sectionRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/upload',   require('./routes/uploadRoutes'));
app.use('/api/ai',       require('./routes/aiRoutes'));
app.use('/api',          require('./routes/publicRoutes'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// Validate DATABASE_URL before attempting connection
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
  console.error('   → In Railway: go to your app service → Variables → add a reference to the PostgreSQL DATABASE_URL');
  process.exit(1);
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════╗
║         🍽  Menuify Server Running        ║
╠══════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}
║  API:     http://localhost:${PORT}/api
╚══════════════════════════════════════════╝
`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:');
    console.error('   Code   :', err.code    || '—');
    console.error('   Message:', err.message || String(err));
    console.error('   Detail :', err.detail  || '—');
    if (err.code === 'ECONNREFUSED') {
      console.error('   → Cannot reach PostgreSQL. Check DATABASE_URL is correct and the Postgres service is running.');
    }
    if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN' || err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      console.error('   → SSL certificate error. Set NODE_ENV=production so SSL is enabled.');
    }
    process.exit(1);
  });
