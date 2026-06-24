import { Router } from "express";
import { requireEmployeeAuth } from "../lib/userAuth";
import { requireAdminPin } from "../lib/adminAuth";
import { db } from "@workspace/db";
import { storesTable, inventoryCountsTable, inventoryEntriesTable, alertsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/stores", requireEmployeeAuth, async (_req, res) => {
  const stores = await db.select().from(storesTable).orderBy(asc(storesTable.storeNumber));
  res.json(stores.map((s) => ({ id: s.id, name: s.name, storeNumber: s.storeNumber })));
});

router.post("/stores", requireAdminPin, async (req, res) => {
  const { name, storeNumber } = req.body as { name?: string; storeNumber?: string };

  if (!name?.trim() || !storeNumber?.trim()) {
    res.status(400).json({ error: "name and storeNumber are required" });
    return;
  }

  const [created] = await db
    .insert(storesTable)
    .values({ name: name.trim(), storeNumber: storeNumber.trim() })
    .returning();

  if (!created) {
    res.status(500).json({ error: "Failed to create store" });
    return;
  }

  res.status(201).json({ id: created.id, name: created.name, storeNumber: created.storeNumber });
});

router.patch("/stores/:storeId", requireAdminPin, async (req, res) => {
  const storeId = Number(req.params["storeId"]);
  const { name, storeNumber } = req.body as { name?: string; storeNumber?: string };

  const updates: Partial<typeof storesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (storeNumber !== undefined) updates.storeNumber = storeNumber;

  const [updated] = await db
    .update(storesTable)
    .set(updates)
    .where(eq(storesTable.id, storeId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  res.json({ id: updated.id, name: updated.name, storeNumber: updated.storeNumber });
});

router.delete("/stores/:storeId", requireAdminPin, async (req, res) => {
  const storeId = Number(req.params["storeId"]);

  const counts = await db
    .select({ id: inventoryCountsTable.id })
    .from(inventoryCountsTable)
    .where(eq(inventoryCountsTable.storeId, storeId));

  for (const count of counts) {
    await db.delete(inventoryEntriesTable).where(eq(inventoryEntriesTable.countId, count.id));
  }
  await db.delete(inventoryCountsTable).where(eq(inventoryCountsTable.storeId, storeId));
  await db.delete(alertsTable).where(eq(alertsTable.storeId, storeId));
  await db.delete(storesTable).where(eq(storesTable.id, storeId));

  res.json({ success: true, id: storeId });
});

export default router;
