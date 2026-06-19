---
name: Inventory running balance model
description: How on-hand inventory is calculated and updated across the app
---

## Model

On-hand quantity is a running balance stored in `inventory_on_hand` table (unique per store+chemical).

**Sources that update it:**
- `count` — POST /inventory submission resets baseline (overwrites)
- `received` — POST /received adds to balance (`quantity + received`)
- `pull` — POST /pulls subtracts from balance (`quantity - pulled`)
- `adjustment` — PATCH /on-hand/adjust directly sets quantity (manual correction)

**Why:** Previously GET /on-hand just returned the latest count snapshot. Changed to a live running balance so pulls and receives affect on-hand in real time without needing a new weekly count.

**How to apply:** Any new feature that changes chemical quantities (new pull/receive type) must also upsert `inventoryOnHandTable` with `onConflictDoUpdate`.

## Report averaging
Trend report (`GET /reports/trend`) skips zero quantities:
- Uses `CASE WHEN ie.quantity > 0 THEN ... END` so unfilled entries don't dilute averages

## Backfill
Existing count data was backfilled into `inventory_on_hand` via SQL `DISTINCT ON (store_id, chemical_id) ORDER BY submitted_at DESC`.
