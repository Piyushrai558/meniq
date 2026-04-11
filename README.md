# 🍽 MenuQR — Full Stack (React + Node.js + SQLite)

Digital menu platform for Indian restaurants. Create menus, generate QR codes, track analytics.

## Tech Stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT + bcrypt
- **QR:** Server-side generation

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ ([download](https://nodejs.org))

### Setup

```bash
# 1. Enter the project
cd menuqr-fullstack

# 2. Install all dependencies (server + client)
npm run install:all

# 3. Seed database with demo data
npm run seed

# 4. Run both frontend & backend in dev mode
npm run dev
```

Opens at: **http://localhost:5173** (Vite dev server with API proxy)

### Demo Credentials
```
Email:    demo@spicegarden.com
Password: demo123
```

### Production Build
```bash
npm start
# Builds React → serves at http://localhost:3000
```

## 📁 Project Structure

```
menuqr-fullstack/
├── package.json            # Root scripts + server deps
├── .env                    # Environment variables
├── server/
│   ├── index.js            # Express entry point
│   ├── database.js         # SQLite setup
│   ├── auth.js             # JWT middleware
│   ├── seed.js             # Demo data seeder
│   └── routes/
│       ├── authRoutes.js
│       ├── menuRoutes.js
│       ├── sectionRoutes.js
│       └── publicRoutes.js
├── client/
│   ├── package.json        # React deps
│   ├── vite.config.js      # Vite + API proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx        # Entry point
│       ├── App.jsx         # Router + layout
│       ├── api.js          # API helper
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── Modal.jsx
│       │   └── Toast.jsx
│       ├── pages/
│       │   ├── Landing.jsx
│       │   ├── Auth.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Editor.jsx
│       │   └── PublicMenu.jsx
│       └── styles/
│           └── global.css
└── db/                     # SQLite DB (auto-created)
```

## Dev Mode vs Production

| | Dev (`npm run dev`) | Prod (`npm start`) |
|---|---|---|
| Frontend | Vite @ :5173 with HMR | Built → served by Express |
| Backend | Express @ :3000 | Express @ :3000 |
| Proxy | Vite proxies /api → :3000 | Direct (same origin) |

## API Endpoints

### Auth
- `POST /api/auth/signup` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Menus (auth required)
- `GET /api/menus` — List menus
- `POST /api/menus` — Create menu
- `GET /api/menus/:id` — Full menu + sections + items
- `PUT /api/menus/:id` — Update menu
- `DELETE /api/menus/:id` — Delete menu

### Sections & Items (auth required)
- `POST /api/sections` — Create section
- `POST /api/sections/items` — Create item
- `PUT /api/sections/items/:id` — Update item
- `DELETE /api/sections/items/:id` — Delete item

### Public (no auth)
- `GET /api/public/menu/:slug` — Public menu
- `GET /api/public/qr/:slug` — QR code
- `GET /api/analytics/:menuId` — Analytics (auth)
