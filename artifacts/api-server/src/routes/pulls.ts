import { Router } from "express";
import { db } from "@workspace/db";
import { chemicalPullsTable, storesTable, chemicalsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/pulls", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const chemicalId = req.query["chemicalId"] ? Number(req.query["chemicalId"]) : undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 200;

  const conditions = [];
  if (storeId) conditions.push(eq(chemicalPullsTable.storeId, storeId));
  if (chemicalId) conditions.push(eq(chemicalPullsTable.chemicalId, chemicalId));

  const records = await db
    .select({
      id: chemicalPullsTable.id,
      storeId: chemicalPullsTable.storeId,
      storeName: storesTable.name,
      chemicalId: chemicalPullsTable.chemicalId,
      chemicalName: chemicalsTable.name,
      quantity: chemicalPullsTable.quantity,
      unit: chemicalPullsTable.unit,
      pulledAt: chemicalPullsTable.pulledAt,
      initials: chemicalPullsTable.initials,
      userId: chemicalPullsTable.userId,
      userName: usersTable.name,
      notes: chemicalPullsTable.notes,
      createdAt: chemicalPullsTable.createdAt,
    })
    .from(chemicalPullsTable)
    .innerJoin(storesTable, eq(chemicalPullsTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(chemicalPullsTable.chemicalId, chemicalsTable.id))
    .leftJoin(usersTable, eq(chemicalPullsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(chemicalPullsTable.pulledAt))
    .limit(limit);

  res.json(records.map((r) => ({
    ...r,
    pulledAt: r.pulledAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/pulls", async (req, res) => {
  const { storeId, chemicalId, quantity, unit, pulledAt, initials, notes, userId } = req.body as {
    storeId: number;
    chemicalId: number;
    quantity: number;
    unit?: string;
    pulledAt?: string;
    initials: string;
    notes?: string;
    userId?: number | null;
  };

  const [record] = await db
    .insert(chemicalPullsTable)
    .values({
      storeId: Number(storeId),
      chemicalId: Number(chemicalId),
      quantity: Number(quantity),
      unit: unit ?? "gallons",
      pulledAt: pulledAt ? new Date(pulledAt) : new Date(),
      initials: initials.trim().toUpperCase(),
      userId: userId ?? null,
      notes: notes ?? null,
    })
    .returning();

  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, record!.storeId));
  const [chemical] = await db.select({ name: chemicalsTable.name }).from(chemicalsTable).where(eq(chemicalsTable.id, record!.chemicalId));
  const [user] = record!.userId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, record!.userId))
    : [{ name: null }];

  res.json({
    ...record,
    storeName: store?.name ?? "",
    chemicalName: chemical?.name ?? "",
    userName: user?.name ?? null,
    pulledAt: record!.pulledAt.toISOString(),
    createdAt: record!.createdAt.toISOString(),
  });
});

router.delete("/pulls/:pullId", async (req, res) => {
  const pullId = Number(req.params["pullId"]);
  await db.delete(chemicalPullsTable).where(eq(chemicalPullsTable.id, pullId));
  res.json({ success: true, id: pullId });
});

export default router;
