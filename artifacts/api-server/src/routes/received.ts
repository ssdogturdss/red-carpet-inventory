import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryReceivedTable, chemicalOrdersTable, storesTable, chemicalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/received", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const chemicalId = req.query["chemicalId"] ? Number(req.query["chemicalId"]) : undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 200;

  const conditions = [];
  if (storeId) conditions.push(eq(inventoryReceivedTable.storeId, storeId));
  if (chemicalId) conditions.push(eq(inventoryReceivedTable.chemicalId, chemicalId));

  const records = await db
    .select({
      id: inventoryReceivedTable.id,
      storeId: inventoryReceivedTable.storeId,
      storeName: storesTable.name,
      chemicalId: inventoryReceivedTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantityReceived: inventoryReceivedTable.quantityReceived,
      unit: inventoryReceivedTable.unit,
      receivedDate: inventoryReceivedTable.receivedDate,
      receivedBy: inventoryReceivedTable.receivedBy,
      poNumber: inventoryReceivedTable.poNumber,
      orderId: inventoryReceivedTable.orderId,
      notes: inventoryReceivedTable.notes,
      createdAt: inventoryReceivedTable.createdAt,
    })
    .from(inventoryReceivedTable)
    .innerJoin(storesTable, eq(inventoryReceivedTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(inventoryReceivedTable.chemicalId, chemicalsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryReceivedTable.receivedDate))
    .limit(limit);

  res.json(records.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/received", async (req, res) => {
  const { storeId, chemicalId, quantityReceived, unit, receivedDate, receivedBy, poNumber, orderId, notes } =
    req.body as {
      storeId: number; chemicalId: number; quantityReceived: number; unit?: string;
      receivedDate: string; receivedBy?: string; poNumber?: string; orderId?: number; notes?: string;
    };

  const [record] = await db
    .insert(inventoryReceivedTable)
    .values({
      storeId: Number(storeId),
      chemicalId: Number(chemicalId),
      quantityReceived: Number(quantityReceived),
      unit: unit ?? "gallons",
      receivedDate,
      receivedBy: receivedBy ?? null,
      poNumber: poNumber ?? null,
      orderId: orderId ? Number(orderId) : null,
      notes: notes ?? null,
    })
    .returning();

  if (record.orderId) {
    await db
      .update(chemicalOrdersTable)
      .set({ status: "received" })
      .where(eq(chemicalOrdersTable.id, record.orderId));
  }

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, record.storeId));
  const [chemical] = await db.select({ name: chemicalsTable.name }).from(chemicalsTable).where(eq(chemicalsTable.id, record.chemicalId));

  res.json({ ...record, storeName: store?.name ?? "", chemicalName: chemical?.name ?? "", createdAt: record.createdAt.toISOString() });
});

router.delete("/received/:receivedId", async (req, res) => {
  const receivedId = Number(req.params["receivedId"]);
  await db.delete(inventoryReceivedTable).where(eq(inventoryReceivedTable.id, receivedId));
  res.json({ success: true, id: receivedId });
});

export default router;
