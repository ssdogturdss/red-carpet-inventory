#!/usr/bin/env node
/**
 * Portable Expo dev-server launcher.
 * Works both inside Replit (sets up proxy/hostname vars) and outside (plain expo start).
 */
const { execSync, spawn } = require("child_process");

const port = process.env.PORT || "8081";
const isReplit = !!process.env.REPL_ID;

const env = { ...process.env };

if (isReplit) {
  // Wire up Replit's proxying so QR codes and Metro work inside the iframe
  if (process.env.REPLIT_EXPO_DEV_DOMAIN) {
    env.EXPO_PACKAGER_PROXY_URL = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
    env.REACT_NATIVE_PACKAGER_HOSTNAME = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_EXPO_DEV_DOMAIN;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    env.EXPO_PUBLIC_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
  }
  if (process.env.REPL_ID) {
    env.EXPO_PUBLIC_REPL_ID = process.env.REPL_ID;
  }
} else {
  // Outside Replit: use EXPO_PUBLIC_DOMAIN if explicitly set, otherwise localhost
  if (!env.EXPO_PUBLIC_DOMAIN) {
    env.EXPO_PUBLIC_DOMAIN = `localhost:${port}`;
  }
}

const args = ["exec", "expo", "start", "--localhost", "--port", port];

const child = spawn("pnpm", args, {
  stdio: "inherit",
  env,
  cwd: __dirname + "/..",
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start Expo:", err.message);
  process.exit(1);
});
