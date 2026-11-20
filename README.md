# BuiltGlory Backend

Node.js Express API for BuiltGlory — auth, properties, enquiries, acquisitions, payments, uploads, and notifications.

Architecture reference: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

- **Node.js 20+**, **Express 5**
- **MongoDB** (Mongoose)
- **Redis** (production)
- **Socket.IO**, **Firebase Admin** (push), **AWS S3**
- **Payments:** manual escrow only (bank / UPI / cheque / cash). Admins verify payment proofs. Online gateways (Razorpay / Worldline / Paynimo) are **not** implemented.

## Structure

Feature modules live in `src/modules/<module>/`, with one file per role:
`<module>.routes.js`, `.controller.js`, `.service.js`, `.repository.js`, `.model.js`,
`.schema.js`, `.validation.js`, `.error.js`, `.permissions.js` and `.swagger.js`.
Routers are mounted in `src/routes/index.js`. Shared errors live in `src/modules/error`.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the folder layout, request flow and conventions.

## Setup

```bash
npm install
cp .env.example .env
# Start MongoDB, and start Redis for this machine (Docker Desktop on Windows):
docker compose -f deploy/docker-compose.local.yml up -d redis
npm run dev
```

Set `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in `.env`. Those values are per laptop. The API does not hardcode a Redis address. If local Redis is down, development keeps running, logs the refused address, and retries with exponential backoff. Sessions, OTP, rate limits, and job locks return errors until Redis is back. They are not silently skipped. `REDIS_ENABLED=false` is the single-process memory store.

API runs at `http://localhost:5001` by default. Swagger UI is available in development and hidden when `NODE_ENV=production`.

SMS credentials belong in `.env` only. Do not add a `config.json`. Production and staging refuse the default JWT secrets, and a hosted process refuses to start until `NODE_ENV` is set. Use a MongoDB replica set in production so deal close and listing conversion commit atomically; a standalone server still accepts those writes without a transaction. The API process runs the background jobs every 15 minutes.

## Environment

Copy `.env.example` to `.env`. Minimum for local dev:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_ENABLED` / `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis for this machine. `REDIS_URL` wins. Password stays in `.env` only |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_SECRET` | Auth signing secrets |
| `CORS_ORIGINS` | Allowed frontend origins (dashboard + Expo web) |

See `.env.example` for S3, SMTP, Firebase, and optional Razorpay env keys (reserved for a future gateway; unused by the current manual-payment flow).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with nodemon |
| `npm start` | Production server |
| `npm test` | Run the full Jest suite |
| `npm run test:automation` | Run the backend automation checklist (quality, architecture, API, auth, database, business rules, errors, security, integration, performance) |
| `npm run seed` | Seed admin user |
| `npm run migrate` | Run migrations |
| `npm run openapi` | Regenerate OpenAPI spec |

## Related repos

- **App** — `BuiltGlory-App` (customer mobile app)
- **Dashboard** — `builtglory-frontend-1.1` (admin UI)
