import { type Request, type Response, type NextFunction } from "express";
import { logger } from "./logger";

const ADMIN_PIN_HEADER = "x-admin-pin";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AdminRateLimitState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const adminRateLimitMap = new Map<string, AdminRateLimitState>();

function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function checkAdminRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const state = adminRateLimitMap.get(ip);
  if (!state) return { allowed: true };
  if (state.lockedUntil > now) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now };
  }
  if (now - state.windowStart > WINDOW_MS) {
    adminRateLimitMap.delete(ip);
    return { allowed: true };
  }
  if (state.failures >= MAX_FAILURES) {
    state.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }
  return { allowed: true };
}

function recordAdminFailure(ip: string): void {
  const now = Date.now();
  const state = adminRateLimitMap.get(ip);
  if (!state || now - state.windowStart > WINDOW_MS) {
    adminRateLimitMap.set(ip, { failures: 1, windowStart: now, lockedUntil: 0 });
    return;
  }
  state.failures += 1;
  if (state.failures >= MAX_FAILURES) {
    state.lockedUntil = now + LOCKOUT_MS;
  }
}

function clearAdminFailures(ip: string): void {
  adminRateLimitMap.delete(ip);
}

function getConfiguredAdminPin(): string | null {
  return process.env.ADMIN_PIN ?? null;
}

/**
 * Verifies a PIN against the configured ADMIN_PIN, enforcing rate limiting per IP.
 * Returns null if ADMIN_PIN is not configured.
 * Returns false if the PIN is wrong.
 * Returns true if the PIN is correct.
 */
export function verifyAdminPin(
  pin: string | undefined,
  ip: string
): { result: "ok" } | { result: "wrong" } | { result: "unconfigured" } | { result: "rate_limited"; retryAfterMs: number } {
  const configuredPin = getConfiguredAdminPin();
  if (!configuredPin) {
    return { result: "unconfigured" };
  }

  const rateCheck = checkAdminRateLimit(ip);
  if (!rateCheck.allowed) {
    logger.warn({ ip }, "Admin PIN rate limit exceeded");
    return { result: "rate_limited", retryAfterMs: rateCheck.retryAfterMs ?? LOCKOUT_MS };
  }

  if (!pin || pin !== configuredPin) {
    recordAdminFailure(ip);
    logger.warn({ ip }, "Failed admin PIN attempt");
    return { result: "wrong" };
  }

  clearAdminFailures(ip);
  return { result: "ok" };
}

/**
 * Express middleware that enforces admin PIN authentication via the x-admin-pin header.
 * Fails closed if ADMIN_PIN is not configured (503).
 * Rate-limits by client IP (429 after repeated failures).
 */
export function requireAdminPin(req: Request, res: Response, next: NextFunction): void {
  const pin = req.headers[ADMIN_PIN_HEADER] as string | undefined;
  const ip = getClientIp(req);
  const check = verifyAdminPin(pin, ip);

  if (check.result === "ok") {
    next();
    return;
  }

  if (check.result === "unconfigured") {
    logger.error("Admin PIN not configured — admin access disabled");
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }

  if (check.result === "rate_limited") {
    const retryAfterSec = Math.ceil(check.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Too many attempts. Try again later.", retryAfterSec });
    return;
  }

  res.status(401).json({ error: "Admin PIN required" });
}
