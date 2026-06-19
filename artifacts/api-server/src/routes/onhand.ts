import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryOnHandTable, storesTable, chemicalsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/on-hand", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;

  if (!storeId) {
    res.status(400).json({ error: "storeId query parameter is required" });
    return;
  }

  const [store] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, storeId));

  const entries = await db
    .select({
      chemicalId: inventoryOnHandTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantity: inventoryOnHandTable.quantity,
      unit: inventoryOnHandTable.unit,
      source: inventoryOnHandTable.source,
      updatedAt: inventoryOnHandTable.updatedAt,
    })
    .from(inventoryOnHandTable)
    .innerJoin(chemicalsTable, eq(inventoryOnHandTable.chemicalId, chemicalsTable.id))
    .where(eq(inventoryOnHandTable.storeId, storeId))
    .orderBy(chemicalsTable.name);

  const lastUpdated =
    entries.length > 0
      ? entries.reduce(
          (latest, e) => (e.updatedAt > latest ? e.updatedAt : latest),
          entries[0]!.updatedAt
        )
      : null;

  res.json({
    storeId,
    storeName: store?.name ?? "",
    updatedAt: lastUpdated ? lastUpdated.toISOString() : null,
    entries: entries.map((e) => ({
      ...e,
      updatedAt: e.updatedAt.toISOString(),
    })),
  });
});

router.patch("/on-hand/adjust", async (req, res) => {
  const { storeId, chemicalId, quantity, unit } = req.body as {
    storeId: number;
    chemicalId: number;
    quantity: number;
    unit?: string;
  };

  if (!storeId || !chemicalId || quantity === undefined || quantity === null) {
    res.status(400).json({ error: "storeId, chemicalId, and quantity are required" });
    return;
  }

  const [chem] = await db
    .select({ name: chemicalsTable.name, unit: chemicalsTable.unit })
    .from(chemicalsTable)
    .where(eq(chemicalsTable.id, Number(chemicalId)));

  const [record] = await db
    .insert(inventoryOnHandTable)
    .values({
      storeId: Number(storeId),
      chemicalId: Number(chemicalId),
      quantity: Number(quantity),
      unit: unit ?? chem?.unit ?? "gallons",
      source: "adjustment",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [inventoryOnHandTable.storeId, inventoryOnHandTable.chemicalId],
      set: {
        quantity: sql`excluded.quantity`,
        unit: sql`excluded.unit`,
        source: sql`'adjustment'`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  res.json({
    chemicalId: record!.chemicalId,
    chemicalName: chem?.name ?? "",
    quantity: record!.quantity,
    unit: record!.unit,
    source: record!.source,
    updatedAt: record!.updatedAt.toISOString(),
  });
});

export default router;
