# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
# Install all dependencies (root + backend + frontend)
npm run install:all

# Run both servers concurrently in dev mode
npm run dev
# Backend only (port 3001, ts-node + nodemon)
npm run dev:backend
# Frontend only (port 5173, Vite HMR)
npm run dev:frontend

# Production build
npm run build           # builds backend (tsc) + frontend (vite build)
npm run build:backend
npm run build:frontend

# Run production server (serves compiled backend + frontend dist)
npm start
```

No test runner is configured. TypeScript checks:
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

The frontend build deliberately uses **`vite build` only** (no `tsc` step) to avoid TS5101 deprecation errors from `baseUrl` on newer TypeScript versions deployed on Render. Don't add `tsc &&` back to the frontend build script.

## Architecture

### Monorepo Layout
```
root/               ← concurrently dev runner, engines: node>=22
  backend/          ← Express + TypeScript, compiled to dist/
  frontend/         ← React + Vite, built to dist/
```

In production, Express serves the frontend `dist/` as static files from `backend/src/index.ts`. A single Render service handles both.

### Backend (`backend/src/`)

**Database** — PostgreSQL via Supabase, using the `pg` (node-postgres) package. `getDb()` returns a `Pool`; all DB calls are `async/await` with `pool.query(sql, params)` and `$1, $2, ...` placeholders. Schema is created on startup via `initDatabase()` with `CREATE TABLE IF NOT EXISTS` statements. Requires `DATABASE_URL` env var (Supabase connection string — encode any `@` in password as `%40`).

**Authentication** — JWT via `jsonwebtoken`. The `authenticate` middleware in `middleware/auth.ts` accepts three token types in order:
1. User JWT (from login/register) — verified against `JWT_SECRET`, then **user existence is confirmed in the DB** (guards against wiped databases)
2. OAuth access token (same JWT format, with extra `oauth_client_id` field)
3. API key (`tf_live_...` prefix) — SHA-256 hashed, looked up in `api_keys` table

**Routes** — all under `/api/*`. Registered in `index.ts`:
- `/api/auth` — register, login, me, verify-email
- `/api/boards` — boards CRUD + nested groups, items, columns
- `/api/developer/keys` — personal API keys
- `/oauth` and `/api/oauth` — both registered (frontend uses `/api/oauth/*`)
- `/.well-known/oauth-authorization-server` — OAuth discovery

**MCP Server** — two transport modes from `mcp/factory.ts` (one factory, two entrypoints):
- **SSE** (`/mcp/sse` + `/mcp/messages`) — embedded in Express, used by web clients
- **stdio** (`backend/src/mcp/server.ts`) — standalone process for Claude Desktop / CLI. Built separately to `dist/mcp/server.js`. Set `API_URL` and `API_TOKEN` env vars.

MCP tools proxy to the REST API via `callApi()`. The MCP server does NOT touch the database directly — everything goes through the REST layer.

**Email** (`utils/email.ts`) — nodemailer with Gmail SMTP. Only active when `SMTP_USER` + `SMTP_PASS` env vars are set (`isEmailConfigured()` guard). If not configured, registration skips email verification and marks users as `email_verified = 1` automatically.

### Frontend (`frontend/src/`)

**State** — Zustand stores:
- `authStore` — user + JWT token, persisted to `localStorage` as `tf_token`
- `devModeStore` — developer mode toggle, persisted as `tf-dev-mode`
- `themeStore` — dark/light mode, persisted as `tf-theme`

**API client** (`api/client.ts`) — axios instance with `baseURL: '/api'`. Vite dev server proxies `/api` → `http://localhost:3001`. A 401 response automatically clears the token and redirects to `/login`.

**Dark mode** — Tailwind `class` strategy. The `dark` class is applied to `<html>` at startup in `main.tsx` (reads `tf-theme` from localStorage before React renders to avoid flash). `AppLayout` syncs it on theme changes.

**Path alias** — `@/` maps to `frontend/src/` via `tsconfig.json` + `vite.config.ts`.

**Developer Mode** — hidden toggle (`</>` button in sidebar footer). When enabled, shows the Developer section in the sidebar with API Keys, OAuth Clients, and API/MCP Docs pages.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes (prod) | JWT signing secret |
| `NODE_ENV` | Yes (prod) | Set to `production` |
| `PORT` | No | Default `3001` |
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string (`@` in password → `%40`) |
| `SMTP_USER` | No | Gmail address for sending verification emails |
| `SMTP_PASS` | No | Gmail App Password (not regular password) |
| `SMTP_HOST` | No | Default `smtp.gmail.com` |
| `SMTP_PORT` | No | Default `587` |
| `APP_URL` | No | Public URL for email verification links |

## Deployment (Render)

- `.node-version` pins Node 22
- Build command: `npm run install:all && npm run build`
- Start command: `npm start`
- Database is Supabase (PostgreSQL) — persistent, no wipe on redeploy. Set `DATABASE_URL` in Render env vars.
- The auth middleware verifies that JWT users still exist in the database, so stale-token users are cleanly logged out.
