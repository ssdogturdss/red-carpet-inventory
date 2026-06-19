import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryReceivedTable, chemicalOrdersTable, inventoryOnHandTable, storesTable, chemicalsTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

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
      userId: inventoryReceivedTable.userId,
      userName: usersTable.name,
      poNumber: inventoryReceivedTable.poNumber,
      orderId: inventoryReceivedTable.orderId,
      notes: inventoryReceivedTable.notes,
      createdAt: inventoryReceivedTable.createdAt,
    })
    .from(inventoryReceivedTable)
    .innerJoin(storesTable, eq(inventoryReceivedTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(inventoryReceivedTable.chemicalId, chemicalsTable.id))
    .leftJoin(usersTable, eq(inventoryReceivedTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryReceivedTable.receivedDate))
    .limit(limit);

  res.json(records.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/received", async (req, res) => {
  const { storeId, chemicalId, quantityReceived, unit, receivedDate, receivedBy, poNumber, orderId, notes, userId } =
    req.body as {
      storeId: number; chemicalId: number; quantityReceived: number; unit?: string;
      receivedDate: string; receivedBy?: string; poNumber?: string; orderId?: number; notes?: string;
      userId?: number | null;
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
      userId: userId ?? null,
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

  // Update on-hand running balance: add received quantity
  await db
    .insert(inventoryOnHandTable)
    .values({
      storeId: record.storeId,
      chemicalId: record.chemicalId,
      quantity: record.quantityReceived,
      unit: record.unit,
      source: "received",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [inventoryOnHandTable.storeId, inventoryOnHandTable.chemicalId],
      set: {
        quantity: sql`${inventoryOnHandTable.quantity} + excluded.quantity`,
        source: sql`'received'`,
        updatedAt: sql`now()`,
      },
    });

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, record.storeId));
  const [chemical] = await db.select({ name: chemicalsTable.name }).from(chemicalsTable).where(eq(chemicalsTable.id, record.chemicalId));
  const [user] = record.userId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, record.userId))
    : [{ name: null }];

  res.json({ ...record, storeName: store?.name ?? "", chemicalName: chemical?.name ?? "", userName: user?.name ?? null, createdAt: record.createdAt.toISOString() });
});

router.delete("/received/:receivedId", async (req, res) => {
  const receivedId = Number(req.params["receivedId"]);
  await db.delete(inventoryReceivedTable).where(eq(inventoryReceivedTable.id, receivedId));
  res.json({ success: true, id: receivedId });
});

export default router;
