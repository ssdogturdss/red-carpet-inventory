import { Router } from "express";
import { db } from "@workspace/db";
import { chemicalOrdersTable, storesTable, chemicalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/orders", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const status = req.query["status"] as string | undefined;
  const chemicalId = req.query["chemicalId"] ? Number(req.query["chemicalId"]) : undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 200;

  const conditions = [];
  if (storeId) conditions.push(eq(chemicalOrdersTable.storeId, storeId));
  if (status) conditions.push(eq(chemicalOrdersTable.status, status));
  if (chemicalId) conditions.push(eq(chemicalOrdersTable.chemicalId, chemicalId));

  const orders = await db
    .select({
      id: chemicalOrdersTable.id,
      storeId: chemicalOrdersTable.storeId,
      storeName: storesTable.name,
      chemicalId: chemicalOrdersTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantityOrdered: chemicalOrdersTable.quantityOrdered,
      unit: chemicalOrdersTable.unit,
      orderDate: chemicalOrdersTable.orderDate,
      expectedDelivery: chemicalOrdersTable.expectedDelivery,
      status: chemicalOrdersTable.status,
      poNumber: chemicalOrdersTable.poNumber,
      orderedBy: chemicalOrdersTable.orderedBy,
      notes: chemicalOrdersTable.notes,
      createdAt: chemicalOrdersTable.createdAt,
    })
    .from(chemicalOrdersTable)
    .innerJoin(storesTable, eq(chemicalOrdersTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(chemicalOrdersTable.chemicalId, chemicalsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(chemicalOrdersTable.createdAt))
    .limit(limit);

  res.json(orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })));
});

router.post("/orders", async (req, res) => {
  const { storeId, chemicalId, quantityOrdered, unit, orderDate, expectedDelivery, poNumber, orderedBy, notes } =
    req.body as {
      storeId: number; chemicalId: number; quantityOrdered: number; unit?: string;
      orderDate: string; expectedDelivery?: string; poNumber?: string; orderedBy?: string; notes?: string;
    };

  const [order] = await db
    .insert(chemicalOrdersTable)
    .values({
      storeId: Number(storeId),
      chemicalId: Number(chemicalId),
      quantityOrdered: Number(quantityOrdered),
      unit: unit ?? "gallons",
      orderDate,
      expectedDelivery: expectedDelivery ?? null,
      status: "pending",
      poNumber: poNumber ?? null,
      orderedBy: orderedBy ?? null,
      notes: notes ?? null,
    })
    .returning();

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, order.storeId));
  const [chemical] = await db.select({ name: chemicalsTable.name }).from(chemicalsTable).where(eq(chemicalsTable.id, order.chemicalId));

  res.json({ ...order, storeName: store?.name ?? "", chemicalName: chemical?.name ?? "", createdAt: order.createdAt.toISOString() });
});

router.patch("/orders/:orderId", async (req, res) => {
  const orderId = Number(req.params["orderId"]);
  const { status, quantityOrdered, expectedDelivery, poNumber, orderedBy, notes } = req.body as {
    status?: string; quantityOrdered?: number; expectedDelivery?: string;
    poNumber?: string; orderedBy?: string; notes?: string;
  };

  const updates: Partial<typeof chemicalOrdersTable.$inferInsert> = {};
  if (status !== undefined) updates.status = status;
  if (quantityOrdered !== undefined) updates.quantityOrdered = Number(quantityOrdered);
  if (expectedDelivery !== undefined) updates.expectedDelivery = expectedDelivery;
  if (poNumber !== undefined) updates.poNumber = poNumber;
  if (orderedBy !== undefined) updates.orderedBy = orderedBy;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db
    .update(chemicalOrdersTable)
    .set(updates)
    .where(eq(chemicalOrdersTable.id, orderId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/orders/:orderId", async (req, res) => {
  const orderId = Number(req.params["orderId"]);
  await db.delete(chemicalOrdersTable).where(eq(chemicalOrdersTable.id, orderId));
  res.json({ success: true, id: orderId });
});

export default router;
