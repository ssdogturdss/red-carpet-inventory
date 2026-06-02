#!/usr/bin/env bash
# =============================================================================
# Red Carpet Inventory — Disaster Recovery Restore Script
# =============================================================================
# Usage:
#   ./restore.sh <path-to-backup.zip>          # restore to ./restored/
#   ./restore.sh <path-to-backup.zip> <dest>   # restore to custom directory
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[restore]${NC} $*"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $*"; }
err()  { echo -e "${RED}[ err  ]${NC} $*" >&2; }

# ── Args ──────────────────────────────────────────────────────────────────────
ARCHIVE="${1:-}"
DEST="${2:-./restored}"

if [[ -z "$ARCHIVE" ]]; then
  err "Usage: ./restore.sh <path-to-backup.zip> [destination-dir]"
  echo ""
  echo "  Available backups:"
  find ./backups -name "*.zip" 2>/dev/null | sort | sed 's/^/    /' || echo "    (none found)"
  exit 1
fi

if [[ ! -f "$ARCHIVE" ]]; then
  err "Archive not found: $ARCHIVE"
  exit 1
fi

if ! command -v unzip &>/dev/null; then
  err "unzip is not installed. Run: nix-env -iA nixpkgs.unzip"
  exit 1
fi

# ── Verify archive before extracting ─────────────────────────────────────────
log "Verifying archive integrity…"
if ! zip -T "$ARCHIVE" &>/dev/null; then
  err "Archive is corrupt or invalid: $ARCHIVE"
  exit 1
fi
ok "Archive OK"

ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
FILE_COUNT=$(unzip -l "$ARCHIVE" | tail -1 | awk '{print $1}')
log "Archive: $(basename "$ARCHIVE")  |  Size: $ARCHIVE_SIZE  |  Files: $FILE_COUNT"

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
warn "This will extract to: ${BOLD}$DEST${NC}"
if [[ -d "$DEST" ]]; then
  warn "Directory already exists — files may be overwritten."
fi
echo ""
read -rp "  Continue? [y/N] " CONFIRM
if [[ "${CONFIRM,,}" != "y" ]]; then
  log "Aborted."
  exit 0
fi

# ── Extract ───────────────────────────────────────────────────────────────────
mkdir -p "$DEST"
log "Extracting to $DEST …"
unzip -q "$ARCHIVE" -d "$DEST"
ok "Extraction complete"

# ── Post-restore checklist ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══ Post-Restore Steps ══════════════════════════════════════════${NC}"
echo ""
echo "  1. Enter the restored directory:"
echo -e "     ${CYAN}cd $DEST${NC}"
echo ""
echo "  2. Copy your environment variables:"
echo -e "     ${CYAN}cp .env.example .env${NC}  (then fill in DATABASE_URL, SESSION_SECRET, etc.)"
echo ""
echo "  3. Install dependencies:"
echo -e "     ${CYAN}pnpm install${NC}"
echo ""
echo "  4. Push the database schema:"
echo -e "     ${CYAN}pnpm --filter @workspace/db run push${NC}"
echo ""
echo "  5. Start the API server:"
echo -e "     ${CYAN}pnpm --filter @workspace/api-server run dev${NC}"
echo ""
echo "  6. Start the mobile/web app:"
echo -e "     ${CYAN}pnpm --filter @workspace/mobile run dev${NC}"
echo ""
echo -e "${BOLD}═════════════════════════════════════════════════════════════════${NC}"
echo ""
ok "Restore complete → $DEST"
