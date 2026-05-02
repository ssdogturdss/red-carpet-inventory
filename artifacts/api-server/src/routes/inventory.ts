import { Router } from "express";
import { db } from "@workspace/db";
import {
  inventoryCountsTable,
  inventoryEntriesTable,
  storesTable,
  chemicalsTable,
  alertsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { SubmitInventoryCountBody } from "@workspace/api-zod";

const router = Router();

router.get("/inventory", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const weekOf = req.query["weekOf"] as string | undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 50;

  const conditions = [];
  if (storeId) conditions.push(eq(inventoryCountsTable.storeId, storeId));
  if (weekOf) conditions.push(eq(inventoryCountsTable.weekOf, weekOf));

  const counts = await db
    .select({
      id: inventoryCountsTable.id,
      storeId: inventoryCountsTable.storeId,
      storeName: storesTable.name,
      weekOf: inventoryCountsTable.weekOf,
      submittedBy: inventoryCountsTable.submittedBy,
      submittedAt: inventoryCountsTable.submittedAt,
    })
    .from(inventoryCountsTable)
    .innerJoin(storesTable, eq(inventoryCountsTable.storeId, storesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryCountsTable.submittedAt))
    .limit(limit);

  const result = await Promise.all(
    counts.map(async (c) => {
      const entries = await db
        .select({
          chemicalId: inventoryEntriesTable.chemicalId,
          chemicalName: chemicalsTable.name,
          quantity: inventoryEntriesTable.quantity,
          unit: chemicalsTable.unit,
        })
        .from(inventoryEntriesTable)
        .innerJoin(chemicalsTable, eq(inventoryEntriesTable.chemicalId, chemicalsTable.id))
        .where(eq(inventoryEntriesTable.countId, c.id));

      return {
        ...c,
        submittedAt: c.submittedAt.toISOString(),
        entries,
      };
    })
  );

  res.json(result);
});

router.get("/inventory/scan", async (_req, res) => {
  res.status(405).json({ error: "Use POST for scan" });
});

router.get("/inventory/:countId", async (req, res) => {
  const countId = Number(req.params["countId"]);

  const [count] = await db
    .select({
      id: inventoryCountsTable.id,
      storeId: inventoryCountsTable.storeId,
      storeName: storesTable.name,
      weekOf: inventoryCountsTable.weekOf,
      submittedBy: inventoryCountsTable.submittedBy,
      submittedAt: inventoryCountsTable.submittedAt,
    })
    .from(inventoryCountsTable)
    .innerJoin(storesTable, eq(inventoryCountsTable.storeId, storesTable.id))
    .where(eq(inventoryCountsTable.id, countId));

  if (!count) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const entries = await db
    .select({
      chemicalId: inventoryEntriesTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantity: inventoryEntriesTable.quantity,
      unit: chemicalsTable.unit,
    })
    .from(inventoryEntriesTable)
    .innerJoin(chemicalsTable, eq(inventoryEntriesTable.chemicalId, chemicalsTable.id))
    .where(eq(inventoryEntriesTable.countId, countId));

  res.json({ ...count, submittedAt: count.submittedAt.toISOString(), entries });
});

router.post("/inventory", async (req, res) => {
  const parseResult = SubmitInventoryCountBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const body = parseResult.data;

  const [count] = await db
    .insert(inventoryCountsTable)
    .values({
      storeId: body.storeId,
      weekOf: body.weekOf,
      submittedBy: body.submittedBy,
    })
    .returning();

  if (!count) {
    res.status(500).json({ error: "Failed to create count" });
    return;
  }

  await db.insert(inventoryEntriesTable).values(
    body.entries.map((e) => ({
      countId: count.id,
      chemicalId: e.chemicalId,
      quantity: e.quantity,
    }))
  );

  // Compare to previous week's count and generate alerts
  await generateAlerts(count.id, body.storeId, body.weekOf, body.entries, req);

  const [store] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, body.storeId));

  const entries = await db
    .select({
      chemicalId: inventoryEntriesTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantity: inventoryEntriesTable.quantity,
      unit: chemicalsTable.unit,
    })
    .from(inventoryEntriesTable)
    .innerJoin(chemicalsTable, eq(inventoryEntriesTable.chemicalId, chemicalsTable.id))
    .where(eq(inventoryEntriesTable.countId, count.id));

  res.status(201).json({
    id: count.id,
    storeId: count.storeId,
    storeName: store?.name ?? "",
    weekOf: count.weekOf,
    submittedBy: count.submittedBy,
    submittedAt: count.submittedAt.toISOString(),
    entries,
  });
});

async function generateAlerts(
  _countId: number,
  storeId: number,
  weekOf: string,
  entries: Array<{ chemicalId: number; quantity: number }>,
  req: Parameters<Parameters<ReturnType<typeof Router>["post"]>[1]>[0]
) {
  // Find the most recent previous count for this store (before this weekOf)
  const prevCounts = await db
    .select({ id: inventoryCountsTable.id, weekOf: inventoryCountsTable.weekOf })
    .from(inventoryCountsTable)
    .where(
      and(
        eq(inventoryCountsTable.storeId, storeId),
        sql`${inventoryCountsTable.weekOf} < ${weekOf}`
      )
    )
    .orderBy(desc(inventoryCountsTable.weekOf))
    .limit(1);

  if (prevCounts.length === 0) return;

  const prevCount = prevCounts[0]!;

  const prevEntries = await db
    .select({
      chemicalId: inventoryEntriesTable.chemicalId,
      quantity: inventoryEntriesTable.quantity,
    })
    .from(inventoryEntriesTable)
    .where(eq(inventoryEntriesTable.countId, prevCount.id));

  const chemicals = await db.select().from(chemicalsTable);
  const prevMap = new Map(prevEntries.map((e) => [e.chemicalId, e.quantity]));

  for (const entry of entries) {
    const prevQty = prevMap.get(entry.chemicalId);
    if (prevQty === undefined || prevQty === 0) continue;

    const chemical = chemicals.find((c) => c.id === entry.chemicalId);
    if (!chemical) continue;

    const percentChange = ((entry.quantity - prevQty) / prevQty) * 100;
    const absChange = Math.abs(percentChange);

    if (absChange >= chemical.thresholdPercent) {
      const direction: "over" | "under" = percentChange > 0 ? "under" : "over";
      const severity: "warning" | "critical" = absChange >= chemical.thresholdPercent * 2 ? "critical" : "warning";

      await db.insert(alertsTable).values({
        storeId,
        chemicalId: entry.chemicalId,
        weekOf,
        previousQuantity: prevQty,
        currentQuantity: entry.quantity,
        percentChange,
        direction,
        severity,
        acknowledged: false,
      });

      req.log.info({ storeId, chemicalId: entry.chemicalId, percentChange, direction }, "Alert generated");
    }
  }
}

export default router;
