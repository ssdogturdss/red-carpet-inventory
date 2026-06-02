#!/usr/bin/env bash
# =============================================================================
# Red Carpet Inventory — Offline ZIP Disaster Recovery Backup
# =============================================================================
# Usage:
#   ./backup.sh            # daily backup (default)
#   ./backup.sh weekly     # weekly backup
#   ./backup.sh manual     # manual/on-demand backup
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_NAME="red-carpet-inventory"
BACKUP_ROOT="$(cd "$(dirname "$0")" && pwd)/backups"
TIMESTAMP="$(date +%Y-%m-%d-%H%M)"
TIER="${1:-daily}"

case "$TIER" in
  weekly) BACKUP_DIR="$BACKUP_ROOT/weekly" ;;
  manual) BACKUP_DIR="$BACKUP_ROOT/manual" ;;
  *)      BACKUP_DIR="$BACKUP_ROOT/daily"  ;;
esac

FILENAME="${PROJECT_NAME}-backup-${TIMESTAMP}.zip"
OUTPUT="$BACKUP_DIR/$FILENAME"
MAX_KEEP=10

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[backup]${NC} $*"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $*"; }
err()  { echo -e "${RED}[ err  ]${NC} $*" >&2; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
for cmd in zip find; do
  if ! command -v "$cmd" &>/dev/null; then
    err "$cmd is not installed. Run: nix-env -iA nixpkgs.$cmd"
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"
log "Starting ${TIER} backup → $OUTPUT"

# ── Build file list via find (prunes dirs before descending — much faster) ───
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Directories to prune entirely (find never descends into these)
PRUNE_DIRS=(
  ".git"
  "node_modules"
  ".pnpm-store"
  "dist"
  "build"
  ".next"
  "out"
  ".expo"
  ".expo-shared"
  ".cache"
  ".local"
  ".cursor"
  ".idea"
  ".vscode"
  "coverage"
  "tmp"
  "temp"
  ".logs"
  "backups"
)

# Build the -path prune expression for find
PRUNE_EXPR=()
for dir in "${PRUNE_DIRS[@]}"; do
  if [ ${#PRUNE_EXPR[@]} -gt 0 ]; then
    PRUNE_EXPR+=(-o)
  fi
  PRUNE_EXPR+=(-name "$dir" -prune)
done

log "Scanning files…"
FILE_LIST=$(mktemp)

# Collect files: prune excluded dirs, skip junk files
find "$PROJECT_ROOT" \
  \( "${PRUNE_EXPR[@]}" \) \
  -o \( -type f \
    ! -name ".DS_Store" \
    ! -name "Thumbs.db" \
    ! -name "replit.nix.backup" \
    ! -name "*.tsbuildinfo" \
    ! -name "*.log" \
    -print \
  \) > "$FILE_LIST"

FILE_COUNT=$(wc -l < "$FILE_LIST")
log "Found $FILE_COUNT files to archive"

# ── Create archive via stdin (zip -@ reads paths from stdin) ─────────────────
log "Compressing…"
START_TIME=$SECONDS

# zip -@ reads filenames from stdin; -j would strip paths so we use full paths
# and then strip the project root prefix for clean relative paths inside the zip
(cd "$PROJECT_ROOT" && \
  sed "s|^$PROJECT_ROOT/||" "$FILE_LIST" | \
  zip -6 --quiet "$OUTPUT" -@ \
)

rm -f "$FILE_LIST"
ELAPSED=$((SECONDS - START_TIME))

# ── Verify archive ─────────────────────────────────────────────────────────────
if [[ ! -f "$OUTPUT" ]]; then
  err "Archive not created: $OUTPUT"
  exit 1
fi

if ! zip -T "$OUTPUT" &>/dev/null; then
  err "Integrity check failed — removing corrupt archive"
  rm -f "$OUTPUT"
  exit 1
fi

SIZE=$(du -sh "$OUTPUT" | cut -f1)
ok "Archive created: $FILENAME"
ok "Size: $SIZE  |  Files: $FILE_COUNT  |  Elapsed: ${ELAPSED}s"

# ── Rotation: keep the N most recent archives ─────────────────────────────────
mapfile -t ALL_ARCHIVES < <(find "$BACKUP_DIR" -maxdepth 1 -name "*.zip" | sort)
ARCHIVE_COUNT="${#ALL_ARCHIVES[@]}"

if (( ARCHIVE_COUNT > MAX_KEEP )); then
  TO_REMOVE=$(( ARCHIVE_COUNT - MAX_KEEP ))
  for (( i=0; i<TO_REMOVE; i++ )); do
    warn "Rotating: $(basename "${ALL_ARCHIVES[$i]}")"
    rm -f "${ALL_ARCHIVES[$i]}"
  done
  ok "Kept $MAX_KEEP most recent archives"
fi

echo ""
ok "Done → backups/${TIER}/${FILENAME}"
echo ""
echo "  Download : right-click in Replit File Tree → Download"
echo "  Restore  : ./restore.sh $OUTPUT"
echo "  iPhone   : see backup-config.json → iphone section"
echo ""
