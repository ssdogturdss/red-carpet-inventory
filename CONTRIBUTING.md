# Contributing to Red Carpet Inventory

Thank you for improving this project. This guide covers everything you need to get set up and submit a quality contribution.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local setup](#local-setup)
3. [Project structure](#project-structure)
4. [Development workflow](#development-workflow)
5. [Commit conventions](#commit-conventions)
6. [Submitting a pull request](#submitting-a-pull-request)
7. [Release process](#release-process)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 24.x |
| pnpm | latest (`npm i -g pnpm`) |
| PostgreSQL | 15+ (or use the Replit-managed DB) |

---

## Local setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/red-carpet-inventory.git
cd red-carpet-inventory

# 2. Install all workspace dependencies
pnpm install

# 3. Copy env template and fill in values
cp .env.example .env
# Required: DATABASE_URL, SESSION_SECRET
# Optional: ADMIN_PIN (defaults to 1234), SMTP_*, TWILIO_*

# 4. Push the database schema
pnpm --filter @workspace/db run push

# 5. Start the API server (runs on :8080)
pnpm --filter @workspace/api-server run dev

# 6. Start the mobile app (in a second terminal)
pnpm --filter @workspace/mobile run dev
```

On first run the server seeds 11 stores and 23 chemicals automatically.

### Regenerating the API client

When you change `lib/api-spec/openapi.yaml`, regenerate the React Query hooks and Zod schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Commit the generated files alongside your spec change.

---

## Project structure

```
red-carpet-inventory/
├── artifacts/
│   ├── api-server/          # Express 5 + TypeScript API
│   └── mobile/              # Expo (React Native) app
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   └── api-zod/             # Generated Zod schemas
├── scripts/                 # Utility scripts
├── .github/
│   ├── workflows/           # CI + release workflows
│   └── ISSUE_TEMPLATE/      # Bug / feature templates
├── CONTRIBUTING.md          # This file
└── SECURITY.md
```

---

## Development workflow

```bash
# Full typecheck (all packages)
pnpm run typecheck

# Typecheck a single package
pnpm --filter @workspace/api-server run typecheck

# Build the API server
pnpm --filter @workspace/api-server run build

# Push DB schema changes (dev only — production is handled by Replit Publish)
pnpm --filter @workspace/db run push
```

### Code style

- **TypeScript strict mode** is enabled across all packages.
- **No `console.log`** in server code — use `req.log` in route handlers or the `logger` singleton.
- **Zod for all I/O** — validate request bodies and response shapes with the generated schemas.
- **Drizzle for all DB access** — no raw SQL strings.
- Formatting is handled by **Prettier** (run `pnpm exec prettier --write .`).

---

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). The `release-please` bot reads commit messages to determine version bumps and build the changelog automatically.

| Prefix | Version bump | Example |
|--------|-------------|---------|
| `fix:` | patch | `fix: correct alert threshold calculation` |
| `feat:` | minor | `feat: add CSV export for inventory counts` |
| `feat!:` / `BREAKING CHANGE:` | major | `feat!: redesign auth flow` |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:` | none | `docs: update architecture diagram` |

**Format:**

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>  # e.g. Closes #42
```

Scope examples: `api`, `mobile`, `db`, `admin`, `alerts`, `push`.

---

## Submitting a pull request

1. **Branch** from `main`: `git checkout -b feat/your-feature`
2. Make your changes with conventional commits.
3. Run `pnpm run typecheck` — CI will fail if this does.
4. If you changed the OpenAPI spec, run codegen and commit the output.
5. Open a PR against `main` with a clear description of _what_ and _why_.
6. Address reviewer comments; the PR merges once CI is green and approved.

**PR title** should also follow Conventional Commits — `release-please` uses it if the branch is squash-merged.

---

## Release process

Releases are fully automated:

1. Merge conventional-commit PRs to `main`.
2. `release-please.yml` opens a **Release PR** that bumps `version` in `package.json` and updates `CHANGELOG.md`.
3. Merging the Release PR creates a Git tag (`v1.2.3`) and a GitHub Release.
4. The tagged build artifact (API `dist/`) is uploaded and attached to the release.

You never need to manually tag or write a changelog entry.
