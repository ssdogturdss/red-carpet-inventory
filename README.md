# Red Carpet Chemical Inventory

A mobile-first chemical inventory management system for retail stores tracking chemicals on a weekly basis. Store employees fill out counts manually or scan paper sheets with AI-powered OCR. Administrators receive automatic alerts when chemical usage is abnormal.

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Production](#production)
- [Docker](#docker)
- [Database](#database)
- [Mobile App (Expo)](#mobile-app-expo)
- [Testing](#testing)
- [Deployment](#deployment)
- [Repository Structure](#repository-structure)
- [Troubleshooting](#troubleshooting)

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 22+ |
| pnpm | 9+ |
| PostgreSQL | 15+ |
| (optional) Docker + Docker Compose | any recent |

Install pnpm if you don't have it:
```bash
npm install -g pnpm
```

---

## Quick Start (Local)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/red-carpet-inventory.git
cd red-carpet-inventory

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, SESSION_SECRET, ADMIN_PIN, OPENAI_API_KEY

# 4. Push database schema
pnpm --filter @workspace/db run push

# 5. Start the API server
PORT=8080 pnpm --filter @workspace/api-server run dev

# 6. (Separate terminal) Start the mobile/web app
cd artifacts/mobile
PORT=8081 EXPO_PUBLIC_DOMAIN=http://localhost:8080 pnpm exec expo start --port 8081
```

The API server runs at `http://localhost:8080/api`.  
The Expo web preview runs at `http://localhost:8081`.

---

## Environment Variables

Copy `.env.example` to `.env`. All required variables are documented there.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | ✅ | Port the API server listens on |
| `SESSION_SECRET` | ✅ | Long random string for session signing |
| `ADMIN_PIN` | ✅ | 4–6 digit PIN for admin panel access |
| `OPENAI_API_KEY` | ✅ (for Scan) | OpenAI API key for sheet OCR |
| `OPENAI_BASE_URL` | ❌ | Override API base URL (Azure, proxy, etc.) |
| `OPENAI_VISION_MODEL` | ❌ | Vision model name (default: `gpt-4o`) |
| `EXPO_PUBLIC_DOMAIN` | ✅ (mobile) | Base URL of the API server reachable from the app |
| `NODE_ENV` | ❌ | `development` or `production` |

> **Replit users:** `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` are provisioned automatically and take precedence over `OPENAI_API_KEY`.

---

## Development

```bash
# Install all workspace dependencies
pnpm install

# Typecheck everything
pnpm run typecheck

# Start the API server in dev mode (auto-rebuilds)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Start the Expo dev server
cd artifacts/mobile
PORT=8081 EXPO_PUBLIC_DOMAIN=http://localhost:8080 pnpm exec expo start --port 8081

# Regenerate API hooks and Zod schemas after changing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

---

## Production

```bash
# Build the API server
pnpm --filter @workspace/api-server run build

# Start in production
PORT=8080 NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs

# Build the Expo web export
cd artifacts/mobile
EXPO_PUBLIC_DOMAIN=https://your-api-domain.com pnpm exec expo export --platform web --output-dir static-build/web

# Serve the static web export
PORT=3000 node server/serve.js
```

---

## Docker

### Build and run with Docker Compose (recommended)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with real values

# Start postgres + API server
docker compose up --build

# Run detached
docker compose up -d --build

# Stop and remove volumes
docker compose down -v
```

The API server will be available at `http://localhost:8080/api`.

### Build the API image manually

```bash
docker build -t red-carpet-inventory .
docker run \
  -e DATABASE_URL=postgresql://user:pass@host:5432/inventory \
  -e PORT=8080 \
  -e SESSION_SECRET=your-secret \
  -e ADMIN_PIN=1234 \
  -e OPENAI_API_KEY=sk-... \
  -p 8080:8080 \
  red-carpet-inventory
```

---

## Database

This project uses **PostgreSQL** with **Drizzle ORM**.

```bash
# Push schema to the database (development)
pnpm --filter @workspace/db run push

# Generate a migration file (for production deployments)
pnpm --filter @workspace/db run generate

# Apply migrations
pnpm --filter @workspace/db run migrate
```

The database is seeded automatically on first startup (stores, chemicals, default users).

Schema files live in `lib/db/src/schema/`.

---

## Mobile App (Expo)

The app is built with **Expo (React Native)** and supports iOS, Android, and Web.

```bash
# Development
cd artifacts/mobile
PORT=8081 EXPO_PUBLIC_DOMAIN=http://localhost:8080 pnpm exec expo start --port 8081

# iOS simulator
pnpm exec expo run:ios

# Android emulator
pnpm exec expo run:android

# Web browser
pnpm exec expo start --web
```

### Building for the App Store (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build for iOS (requires Apple Developer account)
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --latest
```

Configure your bundle ID and team in `artifacts/mobile/app.json` and credentials in `artifacts/mobile/eas.json`.

---

## Testing

```bash
# Typecheck all packages
pnpm run typecheck

# Build (confirms the server compiles without errors)
pnpm --filter @workspace/api-server run build

# CI runs typechecking, build, schema push, and an API health check automatically
# See .github/workflows/ci.yml
```

---

## Deployment

### VPS / Ubuntu Server

1. Install Node.js 22, pnpm, and PostgreSQL.
2. Clone the repository.
3. Copy `.env.example` to `.env` and fill in production values.
4. Run `pnpm install --frozen-lockfile`.
5. Push the DB schema: `pnpm --filter @workspace/db run push`.
6. Build the API: `pnpm --filter @workspace/api-server run build`.
7. Start with a process manager:
   ```bash
   # Using PM2
   pm2 start "node --enable-source-maps artifacts/api-server/dist/index.mjs" \
     --name api-server --env production
   ```
8. Point a reverse proxy (nginx/caddy) at port 8080.

### NGINX example

See `deploy/nginx.conf.example` for a ready-to-use reverse proxy configuration.

---

## Repository Structure

```
.
├── artifacts/
│   ├── api-server/        # Express API server (Node.js / TypeScript)
│   └── mobile/            # Expo mobile + web app (React Native)
├── lib/
│   ├── db/                # Drizzle ORM schema and migrations
│   ├── api-spec/          # OpenAPI spec (source of truth for all API types)
│   ├── api-client-react/  # Generated React Query hooks (from codegen)
│   ├── api-zod/           # Generated Zod validation schemas
│   └── integrations-openai-ai-server/  # OpenAI client wrapper
├── .env.example           # All required environment variables (copy to .env)
├── Dockerfile             # Production API server container
├── docker-compose.yml     # Local dev: postgres + API server
├── .github/workflows/ci.yml  # CI: typecheck, build, health check
└── pnpm-workspace.yaml    # pnpm monorepo workspace config
```

---

## Troubleshooting

**`DATABASE_URL` not set / connection refused**  
Ensure PostgreSQL is running and `DATABASE_URL` in your `.env` matches your local setup. For Docker Compose the URL is `postgresql://postgres:postgres@localhost:5432/inventory`.

**`ADMIN_PIN not configured` / admin panel disabled**  
Set `ADMIN_PIN` in your `.env` and restart the API server.

**Scan Sheet returns an error / no AI results**  
Verify `OPENAI_API_KEY` is set and has access to a vision-capable model (`gpt-4o` or newer). Set `OPENAI_VISION_MODEL` if you want to use a different model.

**Mobile app cannot reach the API**  
Make sure `EXPO_PUBLIC_DOMAIN` points to the API server's base URL (e.g. `http://192.168.1.x:8080` when testing on a real device — `localhost` won't work from a physical device).

**`PORT` not set error on startup**  
The API server requires `PORT` to be set. Either export it or prefix the start command: `PORT=8080 node ...`.

**Expo web build fails with domain error**  
Set `EXPO_PUBLIC_DOMAIN` before running `expo export`. Example: `EXPO_PUBLIC_DOMAIN=https://your-domain.com pnpm exec expo export --platform web`.
