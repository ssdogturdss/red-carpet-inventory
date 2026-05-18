import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/push/register", async (req, res) => {
  const { token, platform, label } = req.body as {
    token?: string;
    platform?: string;
    label?: string;
  };

  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  const existing = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.token, token));

  if (existing.length > 0) {
    const [updated] = await db
      .update(pushTokensTable)
      .set({ platform: platform ?? "unknown", label: label ?? null, updatedAt: new Date() })
      .where(eq(pushTokensTable.token, token))
      .returning();
    res.json({ ...updated, registered: "updated" });
    return;
  }

  const [created] = await db
    .insert(pushTokensTable)
    .values({ token, platform: platform ?? "unknown", label: label ?? null })
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

export default router;
