import { Router } from "express";
import { requireEmployeeAuth, isAdmin, scopedStoreId, denyIfWrongStore } from "../lib/userAuth";
import { db } from "@workspace/db";
import { chemicalOrdersTable, storesTable, chemicalsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/orders", requireEmployeeAuth, async (req, res) => {
  if (!isAdmin(req) && !req.user?.storeId) {
    res.status(403).json({ error: "No store assigned to your account" });
    return;
  }

  const requestedStoreId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const effectiveStoreId = scopedStoreId(req, requestedStoreId);
  const status = req.query["status"] as string | undefined;
  const chemicalId = req.query["chemicalId"] ? Number(req.query["chemicalId"]) : undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 200;

  const conditions = [];
  if (effectiveStoreId !== null) conditions.push(eq(chemicalOrdersTable.storeId, effectiveStoreId));
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
      userId: chemicalOrdersTable.userId,
      userName: usersTable.name,
      notes: chemicalOrdersTable.notes,
      createdAt: chemicalOrdersTable.createdAt,
    })
    .from(chemicalOrdersTable)
    .innerJoin(storesTable, eq(chemicalOrdersTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(chemicalOrdersTable.chemicalId, chemicalsTable.id))
    .leftJoin(usersTable, eq(chemicalOrdersTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(chemicalOrdersTable.createdAt))
    .limit(limit);

  res.json(orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })));
});

router.post("/orders", requireEmployeeAuth, async (req, res) => {
  const userStoreId = isAdmin(req)
    ? Number(req.body.storeId)
    : (req.user?.storeId ?? null);

  if (!userStoreId) {
    res.status(403).json({ error: "No store assigned to your account" });
    return;
  }

  const { chemicalId, quantityOrdered, unit, orderDate, expectedDelivery, poNumber, orderedBy, notes, userId } =
    req.body as {
      chemicalId: number; quantityOrdered: number; unit?: string;
      orderDate: string; expectedDelivery?: string; poNumber?: string; orderedBy?: string; notes?: string;
      userId?: number | null;
    };

  const [order] = await db
    .insert(chemicalOrdersTable)
    .values({
      storeId: userStoreId,
      chemicalId: Number(chemicalId),
      quantityOrdered: Number(quantityOrdered),
      unit: unit ?? "gallons",
      orderDate,
      expectedDelivery: expectedDelivery ?? null,
      status: "pending",
      poNumber: poNumber ?? null,
      orderedBy: orderedBy ?? null,
      userId: userId ?? null,
      notes: notes ?? null,
    })
    .returning();

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, order.storeId));
  const [chemical] = await db.select({ name: chemicalsTable.name }).from(chemicalsTable).where(eq(chemicalsTable.id, order.chemicalId));
  const [user] = order.userId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId))
    : [{ name: null }];

  res.json({ ...order, storeName: store?.name ?? "", chemicalName: chemical?.name ?? "", userName: user?.name ?? null, createdAt: order.createdAt.toISOString() });
});

router.patch("/orders/:orderId", requireEmployeeAuth, async (req, res) => {
  const orderId = Number(req.params["orderId"]);

  const [existing] = await db
    .select({ storeId: chemicalOrdersTable.storeId })
    .from(chemicalOrdersTable)
    .where(eq(chemicalOrdersTable.id, orderId));

  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (denyIfWrongStore(req, res, existing.storeId)) return;

  const { status, quantityOrdered, expectedDelivery, poNumber, orderedBy, notes, userId } = req.body as {
    status?: string; quantityOrdered?: number; expectedDelivery?: string;
    poNumber?: string; orderedBy?: string; notes?: string; userId?: number | null;
  };

  const updates: Partial<typeof chemicalOrdersTable.$inferInsert> = {};
  if (status !== undefined) updates.status = status;
  if (quantityOrdered !== undefined) updates.quantityOrdered = Number(quantityOrdered);
  if (expectedDelivery !== undefined) updates.expectedDelivery = expectedDelivery;
  if (poNumber !== undefined) updates.poNumber = poNumber;
  if (orderedBy !== undefined) updates.orderedBy = orderedBy;
  if (userId !== undefined) updates.userId = userId ?? null;
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

router.delete("/orders/:orderId", requireEmployeeAuth, async (req, res) => {
  const orderId = Number(req.params["orderId"]);

  const [existing] = await db
    .select({ storeId: chemicalOrdersTable.storeId })
    .from(chemicalOrdersTable)
    .where(eq(chemicalOrdersTable.id, orderId));

  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (denyIfWrongStore(req, res, existing.storeId)) return;

  await db.delete(chemicalOrdersTable).where(eq(chemicalOrdersTable.id, orderId));
  res.json({ success: true, id: orderId });
});

export default router;
