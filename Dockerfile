FROM node:20-alpine

WORKDIR /app

# ── Server dependencies ───────────────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm install

# ── Client dependencies + build ───────────────────────────────────────────────
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# ── Server source ─────────────────────────────────────────────────────────────
COPY server ./server

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
