require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/menus', require('./routes/menuRoutes'));
app.use('/api/sections', require('./routes/sectionRoutes'));
app.use('/api', require('./routes/publicRoutes'));

// Serve React build
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));

// SPA fallback — let React Router handle all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         🍽  MenuQR Server Running        ║
╠══════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}          ║
║  API:     http://localhost:${PORT}/api      ║
╚══════════════════════════════════════════╝
  `);
});
