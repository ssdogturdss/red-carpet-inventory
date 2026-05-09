import { Router } from "express";
import { db } from "@workspace/db";
import {
  inventoryCountsTable,
  inventoryEntriesTable,
  storesTable,
  chemicalsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/export/csv", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const weekOf = req.query["weekOf"] as string | undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 500;

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
      notes: inventoryCountsTable.notes,
      submittedAt: inventoryCountsTable.submittedAt,
    })
    .from(inventoryCountsTable)
    .innerJoin(storesTable, eq(inventoryCountsTable.storeId, storesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryCountsTable.weekOf), storesTable.name)
    .limit(limit);

  const rows: string[] = [];
  rows.push(["Store", "Store ID", "Week Of", "Chemical", "Unit", "Quantity", "Submitted By", "Submitted At", "Notes"].map(csv).join(","));

  for (const count of counts) {
    const entries = await db
      .select({
        chemicalName: chemicalsTable.name,
        unit: chemicalsTable.unit,
        quantity: inventoryEntriesTable.quantity,
      })
      .from(inventoryEntriesTable)
      .innerJoin(chemicalsTable, eq(inventoryEntriesTable.chemicalId, chemicalsTable.id))
      .where(eq(inventoryEntriesTable.countId, count.id));

    for (const e of entries) {
      rows.push([
        count.storeName,
        String(count.storeId),
        count.weekOf,
        e.chemicalName,
        e.unit,
        String(e.quantity),
        count.submittedBy,
        count.submittedAt.toISOString(),
        count.notes ?? "",
      ].map(csv).join(","));
    }
  }

  const filename = weekOf
    ? `inventory_${weekOf}${storeId ? `_store${storeId}` : ""}.csv`
    : `inventory_export.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(rows.join("\r\n"));
});

router.get("/export/grid-csv", async (req, res) => {
  const weekOf = req.query["weekOf"] as string | undefined;

  const stores = await db.select().from(storesTable).orderBy(storesTable.name);
  const chemicals = await db.select().from(chemicalsTable).orderBy(chemicalsTable.name);

  let targetWeekOf = weekOf;
  if (!targetWeekOf) {
    const latest = await db
      .select({ weekOf: inventoryCountsTable.weekOf })
      .from(inventoryCountsTable)
      .orderBy(desc(inventoryCountsTable.weekOf))
      .limit(1);
    targetWeekOf = latest[0]?.weekOf;
  }

  if (!targetWeekOf) {
    res.status(404).json({ error: "No inventory data found" });
    return;
  }

  const counts = await db
    .select({
      storeId: inventoryCountsTable.storeId,
      countId: inventoryCountsTable.id,
    })
    .from(inventoryCountsTable)
    .where(eq(inventoryCountsTable.weekOf, targetWeekOf));

  const dataMap = new Map<string, number>();
  for (const count of counts) {
    const entries = await db
      .select({ chemicalId: inventoryEntriesTable.chemicalId, quantity: inventoryEntriesTable.quantity })
      .from(inventoryEntriesTable)
      .where(eq(inventoryEntriesTable.countId, count.countId));
    for (const e of entries) {
      dataMap.set(`${count.storeId}:${e.chemicalId}`, e.quantity);
    }
  }

  const chemHeaders = chemicals.map((c) => `${c.name} (${c.unit})`);
  const rows: string[] = [];
  rows.push(["Store", ...chemHeaders, "Row Total"].map(csv).join(","));

  for (const store of stores) {
    const vals = chemicals.map((c) => dataMap.get(`${store.id}:${c.id}`) ?? 0);
    const rowTotal = vals.reduce((sum, v) => sum + v, 0);
    rows.push([store.name, ...vals.map(String), String(rowTotal)].map(csv).join(","));
  }

  const totalsRow = ["TOTAL", ...chemicals.map((c) =>
    String(stores.reduce((sum, s) => sum + (dataMap.get(`${s.id}:${c.id}`) ?? 0), 0))
  ), String(Array.from(dataMap.values()).reduce((a, b) => a + b, 0))].map(csv).join(",");
  rows.push(totalsRow);

  const filename = `grid_${targetWeekOf}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(rows.join("\r\n"));
});

function csv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export default router;
