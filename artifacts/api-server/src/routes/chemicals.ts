import { Router } from "express";
import { db } from "@workspace/db";
import { chemicalsTable, inventoryEntriesTable, alertsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/chemicals", async (_req, res) => {
  const chemicals = await db.select().from(chemicalsTable).orderBy(asc(chemicalsTable.name));
  res.json(
    chemicals.map((c) => ({
      id: c.id,
      name: c.name,
      unit: c.unit,
      thresholdPercent: c.thresholdPercent,
    }))
  );
});

router.patch("/chemicals/:chemicalId", async (req, res) => {
  const chemicalId = Number(req.params["chemicalId"]);
  const { name, unit, thresholdPercent } = req.body as {
    name?: string;
    unit?: string;
    thresholdPercent?: number;
  };

  const updates: Partial<typeof chemicalsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (unit !== undefined) updates.unit = unit;
  if (thresholdPercent !== undefined) updates.thresholdPercent = thresholdPercent;

  const [updated] = await db
    .update(chemicalsTable)
    .set(updates)
    .where(eq(chemicalsTable.id, chemicalId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Chemical not found" });
    return;
  }

  res.json({ id: updated.id, name: updated.name, unit: updated.unit, thresholdPercent: updated.thresholdPercent });
});

router.delete("/chemicals/:chemicalId", async (req, res) => {
  const chemicalId = Number(req.params["chemicalId"]);

  await db.delete(inventoryEntriesTable).where(eq(inventoryEntriesTable.chemicalId, chemicalId));
  await db.delete(alertsTable).where(eq(alertsTable.chemicalId, chemicalId));
  await db.delete(chemicalsTable).where(eq(chemicalsTable.id, chemicalId));

  res.json({ success: true, id: chemicalId });
});

export default router;
