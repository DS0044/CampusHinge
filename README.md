
# CampusApp — Campus-Verified Dating Platform

A dating/matching web app for a closed campus community, verified via college email domain. Built as an MVP for ~500–600 users.

## Tech Stack

- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL 16
- **Real-time:** Socket.io
- **File Storage:** AWS S3 (presigned URLs)
- **Email:** Nodemailer (swappable to AWS SES)
- **Payments:** Razorpay Subscriptions
- **Auth:** OTP-based + JWT sessions

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) (for local PostgreSQL)

## Getting Started

### 1. Clone & install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables to set:
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated list of allowed email domains |
| `SMTP_*` | SMTP credentials for sending OTP emails |
| `AWS_*` / `S3_*` | AWS credentials and S3 bucket for photo uploads |
| `RAZORPAY_*` | Razorpay API keys (can be left as placeholders for dev) |

### 3. Start PostgreSQL (Docker)

```bash
docker-compose up -d
```

This starts a Postgres 16 container on port 5432 and auto-runs the initial migration.

If the container already exists or you need to re-run migrations manually:

```bash
npm run migrate
```

### 4. Start the dev server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
```

## Project Structure

```
src/
├── index.js              # Express app + Socket.io entry point
├── config/               # Environment, DB pool, domain allowlist
├── middleware/            # Auth, admin, validation, rate limiting, errors
├── routes/               # Express route definitions
├── controllers/          # Route handler functions
├── services/             # Business logic (OTP, email, S3, payments, socket)
├── validators/           # Zod schemas for request validation
└── db/
    ├── migrate.js        # Migration runner
    └── migrations/       # SQL migration files
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/signup` | — | Register with campus email |
| `POST` | `/api/auth/verify-otp` | — | Verify OTP and receive JWT |
| `POST` | `/api/profile` | JWT | Create/update profile |
| `GET` | `/api/profile` | JWT | Get own profile |
| `GET` | `/api/discover` | JWT | Swipeable discovery deck |
| `POST` | `/api/swipe` | JWT | Like or pass on a profile |
| `GET` | `/api/matches` | JWT | List matches |
| `GET` | `/api/messages/:matchId` | JWT | Message history |
| `POST` | `/api/messages/:matchId` | JWT | Send message (paywall enforced) |
| `POST` | `/api/subscribe` | JWT | Create subscription |
| `POST` | `/api/report` | JWT | Report a user |
| `POST` | `/api/block` | JWT | Block a user |
| `GET` | `/api/admin/reports` | Admin | View reports |
| `POST` | `/api/admin/ban/:userId` | Admin | Ban a user |
