import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryCountsTable, inventoryEntriesTable, storesTable, chemicalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/on-hand", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;

  if (!storeId) {
    res.status(400).json({ error: "storeId query parameter is required" });
    return;
  }

  const [latestCount] = await db
    .select({ id: inventoryCountsTable.id, weekOf: inventoryCountsTable.weekOf })
    .from(inventoryCountsTable)
    .where(eq(inventoryCountsTable.storeId, storeId))
    .orderBy(desc(inventoryCountsTable.submittedAt))
    .limit(1);

  if (!latestCount) {
    const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, storeId));
    res.json({ storeId, storeName: store?.name ?? "", weekOf: null, entries: [] });
    return;
  }

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, storeId));

  const entries = await db
    .select({
      chemicalId: inventoryEntriesTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantity: inventoryEntriesTable.quantity,
      unit: chemicalsTable.unit,
    })
    .from(inventoryEntriesTable)
    .innerJoin(chemicalsTable, eq(inventoryEntriesTable.chemicalId, chemicalsTable.id))
    .where(eq(inventoryEntriesTable.countId, latestCount.id))
    .orderBy(chemicalsTable.name);

  res.json({
    storeId,
    storeName: store?.name ?? "",
    weekOf: latestCount.weekOf,
    entries,
  });
});

export default router;
