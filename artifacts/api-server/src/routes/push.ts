import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
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

router.post("/push/register", async (req, res) => {
  const { token, platform, label, minSeverity } = req.body as {
    token?: string;
    platform?: string;
    label?: string;
    minSeverity?: string;
  };

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  const severity = minSeverity === "critical" ? "critical" : "warning";

  const existing = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.token, token));

  if (existing.length > 0) {
    const [updated] = await db
      .update(pushTokensTable)
      .set({
        platform: platform ?? "unknown",
        label: label ?? null,
        minSeverity: severity,
        updatedAt: new Date(),
      })
      .where(eq(pushTokensTable.token, token))
      .returning();
    res.json({ ...updated, registered: "updated" });
    return;
  }

  const [created] = await db
    .insert(pushTokensTable)
    .values({ token, platform: platform ?? "unknown", label: label ?? null, minSeverity: severity })
    .returning();

  res.status(201).json({ ...created, registered: "created" });
});

router.delete("/push/register", async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
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

export default router;
