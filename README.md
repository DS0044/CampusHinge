# CampusHinge — Campus-Verified Dating & Matching Platform

A modern dating and social discovery platform for closed campus communities, verified via college email domains.

---

## 📁 Repository Structure

The codebase is organized into three distinct, dedicated applications:

```
CampusHinge/
├── backend/          # Node.js + Express REST API, SQLite DB, and Cloudflare Worker
├── frontend/         # Student web application (React + Vite, Port 5173)
├── admin-panel/      # Safety & moderation portal (React + Vite, Port 5174)
└── package.json      # Monorepo root orchestration scripts
```

---

## 🚀 Quick Start

### 1. Run Development Servers

From the root directory, you can start any of the applications:

```bash
# Start backend API (Port 3000)
npm run dev:backend

# Start student frontend app (Port 5173)
npm run dev:frontend

# Start admin moderation panel (Port 5174)
npm run dev:admin
```

### 2. Build Production Bundles

```bash
# Build both frontend and admin-panel
npm run build

# Or build individually
npm run build:frontend
npm run build:admin
```

### 3. Run Automated Tests

```bash
# Runs all 53 backend integration and validation tests
npm test
```

### 4. Database Utilities

```bash
# Initialize SQLite database schema
npm run migrate

# Clear all database tables and uploaded files
npm run db:clear
```

---

## 🏛️ Application Roles

### 1. `backend/`
- **REST API Entry**: `backend/src/index.js`
- **Database**: Local SQLite (`campusapp.db` via `better-sqlite3`) and Cloudflare D1 for serverless
- **Real-Time**: Socket.io for chat and instant notifications
- **Worker**: Cloudflare Workers Hono API in `backend/worker/`
- **Tests**: 53 integration tests in `backend/tests/`

### 2. `frontend/`
- **Student App**: Discovery card deck, mutual matching, real-time messaging, profile setup, and notifications.
- **Port**: `http://localhost:5173`

### 3. `admin-panel/`
- **Moderator Portal**: Safety dashboard, user directory, student profile inspection, one-click ban/unban, and reports queue resolution.
- **Port**: `http://localhost:5174`
