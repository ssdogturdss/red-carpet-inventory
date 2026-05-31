import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, storesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function validateAdminPin(pin: string): boolean {
  return pin === (process.env.ADMIN_PIN ?? "1234");
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

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.active, true)));

  if (!user) {
    res.json({ success: false });
    return;
  }

  if (user.pinHash !== hashPin(pin)) {
    req.log.warn({ userId }, "Failed login attempt");
    res.json({ success: false });
    return;
  }

  const token = generateToken();
  await db.update(usersTable).set({ sessionToken: token }).where(eq(usersTable.id, user.id));

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

router.get("/admin/users", async (req, res): Promise<void> => {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  if (!pin || !validateAdminPin(pin)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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

router.post("/admin/users", async (req, res): Promise<void> => {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  if (!pin || !validateAdminPin(pin)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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

router.put("/admin/users/:userId", async (req, res): Promise<void> => {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  if (!pin || !validateAdminPin(pin)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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

router.delete("/admin/users/:userId", async (req, res): Promise<void> => {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  if (!pin || !validateAdminPin(pin)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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
