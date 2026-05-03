# Chemical Inventory App

## Overview

A mobile-first chemical inventory management system for 11 stores tracking 23 chemicals on a weekly basis. Store employees fill out counts manually or scan paper sheets with AI-powered OCR. Administrators receive automatic alerts when chemical usage is abnormal.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with expo-router
- **AI**: OpenAI GPT-5.4 vision for photo OCR (Replit AI Integrations)

## Artifacts

- **`artifacts/api-server`** — Express API server at `/api`
- **`artifacts/mobile`** — Expo mobile app at `/`
- **`artifacts/mockup-sandbox`** — UI sandbox at `/__mockup`

## Key Features

- **Dashboard** — Alert summary by store, quick actions, recent submissions
- **Count Entry** — Fill out all 23 chemical quantities for a store/week manually
- **Scan Sheet** — Take a photo of a paper count sheet; AI reads the quantities automatically
- **History** — Browse all past weekly submissions by store
- **Admin Panel** (PIN-gated) — Full CRUD dashboard for all records:
  - **Alerts tab** — View, acknowledge, and delete alerts; filter by store
  - **Stores tab** — Edit store name/number, delete store (cascades to all counts + alerts)
  - **Products tab** — Edit product name, unit, and alert threshold %; delete products
  - **Counts tab** — View and delete any past submission

## Admin PIN

Default PIN is `1234`. Override by setting the `ADMIN_PIN` environment variable/secret on the server.

## Data Model

- **Stores** — 11 stores seeded (Store 1 Downtown through Store 11 University)
- **Chemicals** — 23 chemicals seeded (Chlorine, pH Plus, Algaecide, etc.) each with a threshold %
- **InventoryCounts** — Weekly counts per store with all 23 entries
- **Alerts** — Auto-generated when count change exceeds threshold %, with severity (warning/critical)

## Alert Logic

When a count is submitted, it compares to the previous week for the same store:
- % change calculated per chemical
- If `|change| >= thresholdPercent` → **warning** alert
- If `|change| >= thresholdPercent * 2` → **critical** alert
- `direction: "over"` = too much chemical used, `"under"` = too little

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## AI Integration

Uses Replit AI Integrations (OpenAI) — no user API key needed. Charges billed to Replit credits.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` provisioned automatically
- Model: `gpt-5.4` with vision for image analysis

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
