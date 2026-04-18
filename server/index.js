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

initDb();

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
app.use('/api',          require('./routes/publicRoutes'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         🍽  MenuQR Server Running        ║
╠══════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}
║  API:     http://localhost:${PORT}/api
╚══════════════════════════════════════════╝
`);
});
