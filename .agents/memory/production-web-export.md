---
name: Production web export
description: How the Expo web app is built and served at the deployed URL (RedCarpetInventory.replit.app)
---

The production server (`server/serve.js`) reads from `static-build/` — NOT gitignored.

`static-build/web/` contains the Expo web export. It must be committed to git and kept up to date when significant code changes are made.

**Why:** The artifact.toml `build` step runs `build.js` (native Expo Go bundle) inside the production container, but it does NOT generate a web bundle. The web export must be pre-built locally and committed. Without it, production only serves the landing page.

**How to apply:**
1. After significant code changes, run:
   `pnpm --filter @workspace/mobile run web-export`
   (sets EXPO_PUBLIC_DOMAIN to RedCarpetInventory.replit.app automatically)
2. Commit the updated `static-build/web/` directory.
3. Redeploy via the Replit publish button.

The `serve.js` checks for `static-build/web/index.html` at startup. If present, it serves the web app (with `.html` extension lookup and SPA fallback). If absent, it serves the Expo Go landing page.
