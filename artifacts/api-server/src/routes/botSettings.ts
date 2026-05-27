import { Router } from "express";
import { db } from "@workspace/db";
import { botSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_PIN_HEADER = "x-admin-pin";

function requireAdminPin(req: any, res: any, next: any) {
  const pin = req.headers[ADMIN_PIN_HEADER] as string | undefined;
  const adminPin = process.env.ADMIN_PIN ?? "1234";
  if (!pin || pin !== adminPin) {
    res.status(401).json({ error: "Admin PIN required" });
    return;
  }
  next();
}

async function getOrCreateSettings() {
  const rows = await db.select().from(botSettingsTable).limit(1);
  if (rows.length > 0) return rows[0]!;
  const inserted = await db.insert(botSettingsTable).values({}).returning();
  return inserted[0]!;
}

// GET /admin/bot-settings
router.get("/admin/bot-settings", requireAdminPin, async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

// PUT /admin/bot-settings
router.put("/admin/bot-settings", requireAdminPin, async (req, res) => {
  const { botName, greeting, systemPromptExtra } = req.body as {
    botName?: string;
    greeting?: string;
    systemPromptExtra?: string;
  };

  const current = await getOrCreateSettings();

  const updated = await db
    .update(botSettingsTable)
    .set({
      ...(botName !== undefined ? { botName } : {}),
      ...(greeting !== undefined ? { greeting } : {}),
      ...(systemPromptExtra !== undefined ? { systemPromptExtra } : {}),
      updatedAt: new Date(),
    })
    .where(eq(botSettingsTable.id, current.id))
    .returning();

  res.json(updated[0]!);
});

// Public read — used by ReportBot UI to display name and greeting (no PIN needed)
router.get("/bot-settings/public", async (_req, res) => {
  const rows = await db.select().from(botSettingsTable).limit(1);
  if (rows.length === 0) {
    res.json({
      botName: "Report Bot",
      greeting:
        "Hi! I'm your Report Bot. Ask me anything about your chemical inventory — usage trends, alerts, store comparisons, deliveries, and more. I'll pull live data and summarize it for you.",
    });
    return;
  }
  const { botName, greeting } = rows[0]!;
  res.json({ botName, greeting });
});

export default router;
