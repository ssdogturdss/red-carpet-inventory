import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { pushTokensTable, pushReceiptsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const ADMIN_PIN_HEADER = "x-admin-pin";

function requireAdminPin(req: Request, res: Response, next: NextFunction) {
  const pin = req.headers[ADMIN_PIN_HEADER] as string | undefined;
  const adminPin = process.env.ADMIN_PIN ?? "1234";
  if (!pin || pin !== adminPin) {
    res.status(401).json({ error: "Admin PIN required" });
    return;
  }
  next();
}

async function upsertToken(
  token: string,
  platform: string,
  label: string | null,
  minSeverity: "warning" | "critical",
  res: Response
) {
  const existing = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.token, token));

  if (existing.length > 0) {
    const [updated] = await db
      .update(pushTokensTable)
      .set({ platform, label, minSeverity, updatedAt: new Date() })
      .where(eq(pushTokensTable.token, token))
      .returning();
    res.json({ ...updated, registered: "updated" });
  } else {
    const [created] = await db
      .insert(pushTokensTable)
      .values({ token, platform, label, minSeverity })
      .returning();
    res.status(201).json({ ...created, registered: "created" });
  }
}

// POST /push-tokens — canonical endpoint (upsert by token value)
router.post("/push-tokens", async (req, res) => {
  const { token, platform, label, minSeverity } = req.body as {
    token?: string;
    platform?: string;
    label?: string;
    minSeverity?: string;
  };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await upsertToken(
    token,
    platform ?? "unknown",
    label ?? null,
    minSeverity === "critical" ? "critical" : "warning",
    res
  );
});

// DELETE /push-tokens/:token — canonical endpoint (delete by token string)
router.delete("/push-tokens/:token", async (req, res) => {
  const token = decodeURIComponent(req.params["token"] ?? "");
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
  res.json({ success: true });
});

// Legacy aliases kept for backward compatibility
router.post("/push/register", async (req, res) => {
  const { token, platform, label, minSeverity } = req.body as {
    token?: string;
    platform?: string;
    label?: string;
    minSeverity?: string;
  };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await upsertToken(
    token,
    platform ?? "unknown",
    label ?? null,
    minSeverity === "critical" ? "critical" : "warning",
    res
  );
});

router.delete("/push/register", async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token));
  res.json({ success: true });
});

router.get("/admin/push-tokens", requireAdminPin, async (_req, res) => {
  const tokens = await db
    .select()
    .from(pushTokensTable)
    .orderBy(desc(pushTokensTable.updatedAt));
  res.json(tokens);
});

router.delete("/admin/push-tokens/:id", requireAdminPin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  await db.delete(pushTokensTable).where(eq(pushTokensTable.id, id));
  res.json({ success: true, id });
});

router.get("/admin/push-receipts", requireAdminPin, async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const status = req.query["status"] as string | undefined;

  const rows = await db
    .select()
    .from(pushReceiptsTable)
    .orderBy(desc(pushReceiptsTable.sentAt))
    .limit(limit);

  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  res.json(filtered);
});

export default router;
