#!/usr/bin/env node
/**
 * Red Carpet Inventory — Cross-Platform Node.js Backup System
 *
 * Works on: Linux, macOS, Windows, Replit
 * Usage:
 *   node backup.js            # daily backup
 *   node backup.js weekly     # weekly backup
 *   node backup.js manual     # manual/on-demand backup
 *   node backup.js --dry-run  # list files without creating archive
 */

import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_NAME = "red-carpet-inventory";
const MAX_KEEP = 10;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const tier = args.find((a) => ["daily", "weekly", "manual"].includes(a)) ?? "daily";

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timestamp = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  pad(now.getHours()) + pad(now.getMinutes()),
].join("-");

const BACKUP_ROOT = path.join(__dirname, "backups");
const BACKUP_DIR = path.join(BACKUP_ROOT, tier);
const FILENAME = `${PROJECT_NAME}-backup-${timestamp}.zip`;
const OUTPUT = path.join(BACKUP_DIR, FILENAME);

// ── Exclusion patterns ─────────────────────────────────────────────────────────
// Each entry is matched against every path segment — if any segment matches,
// the path is excluded.
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".pnpm-store",
  "dist",
  "build",
  ".next",
  "out",
  ".expo",
  ".expo-shared",
  ".cache",
  ".local",
  ".cursor",
  ".idea",
  ".vscode",
  "coverage",
  "tmp",
  "temp",
  ".logs",
  ".git",
  "backups",
]);

const EXCLUDED_EXTENSIONS = new Set([".log", ".tsbuildinfo"]);

const EXCLUDED_FILENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "replit.nix.backup",
]);

function shouldExclude(relativePath) {
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
    if (EXCLUDED_FILENAMES.has(part)) return true;
  }
  const ext = path.extname(relativePath);
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  return false;
}

// ── Collect files recursively ─────────────────────────────────────────────────
function collectFiles(dir, root = dir, collected = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (shouldExclude(rel)) continue;
    if (entry.isDirectory()) {
      collectFiles(full, root, collected);
    } else if (entry.isFile()) {
      collected.push({ full, rel });
    }
  }
  return collected;
}

// ── Rotate old archives ───────────────────────────────────────────────────────
function rotateBackups(dir) {
  const archives = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  while (archives.length > MAX_KEEP) {
    const oldest = archives.shift();
    const oldPath = path.join(dir, oldest.name);
    fs.rmSync(oldPath);
    console.log(`  [rotate] Removed old archive: ${oldest.name}`);
  }
}

// ── Format bytes ─────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log(`  Red Carpet Inventory — Backup System`);
  console.log(`  Tier: ${tier}  |  Timestamp: ${timestamp}`);
  if (DRY_RUN) console.log("  *** DRY RUN — no archive will be created ***");
  console.log("");

  const root = __dirname;
  const startMs = Date.now();

  console.log("  Scanning project files…");
  const files = collectFiles(root);
  console.log(`  Found ${files.length} files to back up`);

  if (DRY_RUN) {
    console.log("\n  Files that would be included:");
    for (const { rel } of files) console.log(`    ${rel}`);
    console.log(`\n  Total: ${files.length} files`);
    return;
  }

  // Ensure output directory exists
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Check for zip availability
  const zipCheck = spawnSync("zip", ["--version"], { stdio: "pipe" });
  if (zipCheck.error) {
    // Fallback: use Node.js archiver if zip binary not found
    console.error(
      "  [warn] zip binary not found — install it with: nix-env -iA nixpkgs.zip"
    );
    process.exit(1);
  }

  // Build zip command with all exclusions as -x patterns
  const excludeArgs = [];
  for (const d of EXCLUDED_DIRS) {
    excludeArgs.push("-x", `*/${d}/*`, "-x", `${d}/*`);
  }
  for (const ext of EXCLUDED_EXTENSIONS) {
    excludeArgs.push("-x", `*${ext}`);
  }
  for (const f of EXCLUDED_FILENAMES) {
    excludeArgs.push("-x", `*/${f}`);
  }
  excludeArgs.push("-x", "*/backups/*");

  console.log(`  Creating archive: ${FILENAME}`);
  const result = spawnSync(
    "zip",
    ["-r9", "--quiet", OUTPUT, ".", ...excludeArgs],
    { cwd: root, stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.error("  [error] zip exited with code", result.status);
    process.exit(1);
  }

  // Verify integrity
  const verify = spawnSync("zip", ["-T", OUTPUT], { stdio: "pipe" });
  if (verify.status !== 0) {
    console.error("  [error] Archive integrity check failed, removing…");
    fs.rmSync(OUTPUT, { force: true });
    process.exit(1);
  }

  const size = fs.statSync(OUTPUT).size;
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log("");
  console.log(`  ✓ Archive created:  ${FILENAME}`);
  console.log(`  ✓ Size:             ${formatBytes(size)}`);
  console.log(`  ✓ Files backed up:  ${files.length}`);
  console.log(`  ✓ Elapsed:          ${elapsed}s`);
  console.log(`  ✓ Location:         backups/${tier}/${FILENAME}`);

  // Rotate
  rotateBackups(BACKUP_DIR);

  console.log("");
  console.log("  To restore: ./restore.sh " + OUTPUT);
  console.log(
    "  To download: right-click the file in Replit → Download"
  );
  console.log("");
}

main().catch((err) => {
  console.error("[fatal]", err.message);
  process.exit(1);
});
