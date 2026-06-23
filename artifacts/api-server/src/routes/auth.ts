import { Router } from "express";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { usersTable, storesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAdminPin } from "../lib/adminAuth";

const router = Router();

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const SCRYPT_PREFIX = "scrypt:";

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, SCRYPT_PARAMS.keylen, { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p });
  return `${SCRYPT_PREFIX}${salt}:${hash.toString("hex")}`;
}

function legacyHashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

function verifyPin(pin: string, storedHash: string): boolean {
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const rest = storedHash.slice(SCRYPT_PREFIX.length);
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) return false;
    const salt = rest.slice(0, colonIdx);
    const expected = rest.slice(colonIdx + 1);
    const actual = scryptSync(pin, salt, SCRYPT_PARAMS.keylen, { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p });
    try {
      return timingSafeEqual(Buffer.from(expected, "hex"), actual);
    } catch {
      return false;
    }
  }
  return timingSafeEqual(
    Buffer.from(storedHash, "hex"),
    Buffer.from(legacyHashPin(pin), "hex")
  );
}

interface LoginAttemptState {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}
const loginAttempts = new Map<number, LoginAttemptState>();
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function checkRateLimit(userId: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const state = loginAttempts.get(userId);
  if (!state) return { allowed: true };
  if (state.lockedUntil > now) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now };
  }
  if (now - state.windowStart > WINDOW_MS) {
    loginAttempts.delete(userId);
    return { allowed: true };
  }
  if (state.failures >= MAX_FAILURES) {
    state.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfterMs: LOCKOUT_MS };
  }
  return { allowed: true };
}

function recordFailure(userId: number): void {
  const now = Date.now();
  const state = loginAttempts.get(userId);
  if (!state || now - state.windowStart > WINDOW_MS) {
    loginAttempts.set(userId, { failures: 1, windowStart: now, lockedUntil: 0 });
    return;
  }
  state.failures += 1;
  if (state.failures >= MAX_FAILURES) state.lockedUntil = now + LOCKOUT_MS;
}

function clearFailures(userId: number): void {
  loginAttempts.delete(userId);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}


router.get("/auth/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      storeId: usersTable.storeId,
      storeName: storesTable.name,
      role: usersTable.role,
    })
    .from(usersTable)
    .leftJoin(storesTable, eq(usersTable.storeId, storesTable.id))
    .where(eq(usersTable.active, true))
    .orderBy(usersTable.name);

  res.json(users);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { userId, pin } = req.body as { userId?: number; pin?: string };
  if (!userId || !pin) {
    res.status(400).json({ success: false, error: "userId and pin required" });
    return;
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil((rateCheck.retryAfterMs ?? LOCKOUT_MS) / 1000);
    res.status(429).json({ success: false, error: "Too many attempts. Try again later.", retryAfterSec });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.active, true)));

  if (!user) {
    recordFailure(userId);
    res.json({ success: false });
    return;
  }

  if (!verifyPin(pin, user.pinHash)) {
    recordFailure(userId);
    req.log.warn({ userId }, "Failed login attempt");
    res.json({ success: false });
    return;
  }

  clearFailures(userId);

  const token = generateToken();
  const updates: Partial<typeof usersTable.$inferInsert> = { sessionToken: token };
  if (!user.pinHash.startsWith(SCRYPT_PREFIX)) {
    updates.pinHash = hashPin(pin);
  }
  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));

  const [storeRow] = user.storeId
    ? await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, user.storeId))
    : [];

  req.log.info({ userId: user.id }, "User logged in");
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      storeId: user.storeId ?? null,
      storeName: storeRow?.name ?? null,
      role: user.role,
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.headers["x-user-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.sessionToken, token), eq(usersTable.active, true)));

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [storeRow] = user.storeId
    ? await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, user.storeId))
    : [];

  res.json({
    id: user.id,
    name: user.name,
    storeId: user.storeId ?? null,
    storeName: storeRow?.name ?? null,
    role: user.role,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.headers["x-user-token"] as string | undefined;
  if (!token) {
    res.json({ success: true, id: 0 });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ sessionToken: null })
    .where(eq(usersTable.sessionToken, token))
    .returning();

  res.json({ success: true, id: user?.id ?? 0 });
});

router.get("/admin/users", requireAdminPin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      storeId: usersTable.storeId,
      storeName: storesTable.name,
      role: usersTable.role,
      active: usersTable.active,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(storesTable, eq(usersTable.storeId, storesTable.id))
    .orderBy(usersTable.name);

  res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/admin/users", requireAdminPin, async (req, res): Promise<void> => {
  const { name, pin: userPin, storeId, role, active } = req.body as {
    name?: string;
    pin?: string;
    storeId?: number | null;
    role?: string;
    active?: boolean;
  };

  if (!name || !userPin) {
    res.status(400).json({ error: "name and pin required" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      pinHash: hashPin(userPin),
      storeId: storeId ?? null,
      role: role ?? "employee",
      active: active ?? true,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const [storeRow] = user.storeId
    ? await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, user.storeId))
    : [];

  req.log.info({ userId: user.id }, "Admin created user");
  res.status(201).json({
    id: user.id,
    name: user.name,
    storeId: user.storeId ?? null,
    storeName: storeRow?.name ?? null,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  });
});

router.put("/admin/users/:userId", requireAdminPin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["userId"]) ? req.params["userId"][0] : req.params["userId"];
  const userId = parseInt(rawId ?? "", 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { name, pin: newPin, storeId, role, active } = req.body as {
    name?: string;
    pin?: string | null;
    storeId?: number | null;
    role?: string;
    active?: boolean;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (newPin) updates.pinHash = hashPin(newPin);
  if (storeId !== undefined) updates.storeId = storeId ?? null;
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [storeRow] = user.storeId
    ? await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, user.storeId))
    : [];

  req.log.info({ userId: user.id }, "Admin updated user");
  res.json({
    id: user.id,
    name: user.name,
    storeId: user.storeId ?? null,
    storeName: storeRow?.name ?? null,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  });
});

router.delete("/admin/users/:userId", requireAdminPin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params["userId"]) ? req.params["userId"][0] : req.params["userId"];
  const userId = parseInt(rawId ?? "", 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));
  req.log.info({ userId }, "Admin deleted user");
  res.json({ success: true, id: userId });
});

export { hashPin };
export default router;
