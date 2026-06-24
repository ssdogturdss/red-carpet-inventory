import { Router } from "express";
import { requireEmployeeAuth, isAdmin, scopedStoreId, denyIfWrongStore } from "../lib/userAuth";
import { db } from "@workspace/db";
import { alertsTable, storesTable, chemicalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/alerts", requireEmployeeAuth, async (req, res) => {
  if (!isAdmin(req) && !req.user?.storeId) {
    res.status(403).json({ error: "No store assigned to your account" });
    return;
  }

  const requestedStoreId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;
  const effectiveStoreId = scopedStoreId(req, requestedStoreId);
  const weekOf = req.query["weekOf"] as string | undefined;
  const acknowledged =
    req.query["acknowledged"] !== undefined
      ? req.query["acknowledged"] === "true"
      : undefined;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 100;

  const conditions = [];
  if (effectiveStoreId !== null) conditions.push(eq(alertsTable.storeId, effectiveStoreId));
  if (weekOf) conditions.push(eq(alertsTable.weekOf, weekOf));
  if (acknowledged !== undefined) conditions.push(eq(alertsTable.acknowledged, acknowledged));

  const alerts = await db
    .select({
      id: alertsTable.id,
      storeId: alertsTable.storeId,
      storeName: storesTable.name,
      chemicalId: alertsTable.chemicalId,
      chemicalName: chemicalsTable.name,
      weekOf: alertsTable.weekOf,
      previousQuantity: alertsTable.previousQuantity,
      currentQuantity: alertsTable.currentQuantity,
      percentChange: alertsTable.percentChange,
      direction: alertsTable.direction,
      severity: alertsTable.severity,
      acknowledged: alertsTable.acknowledged,
      acknowledgedAt: alertsTable.acknowledgedAt,
      createdAt: alertsTable.createdAt,
    })
    .from(alertsTable)
    .innerJoin(storesTable, eq(alertsTable.storeId, storesTable.id))
    .innerJoin(chemicalsTable, eq(alertsTable.chemicalId, chemicalsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alertsTable.createdAt))
    .limit(limit);

  res.json(
    alerts.map((a) => ({
      ...a,
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }))
  );
});

router.get("/alerts/summary", requireEmployeeAuth, async (req, res) => {
  if (!isAdmin(req) && !req.user?.storeId) {
    res.status(403).json({ error: "No store assigned to your account" });
    return;
  }

  const effectiveStoreId = scopedStoreId(req, undefined);

  const allAlerts = await db
    .select({
      storeId: alertsTable.storeId,
      storeName: storesTable.name,
      severity: alertsTable.severity,
      acknowledged: alertsTable.acknowledged,
    })
    .from(alertsTable)
    .innerJoin(storesTable, eq(alertsTable.storeId, storesTable.id))
    .where(effectiveStoreId !== null ? eq(alertsTable.storeId, effectiveStoreId) : undefined);

  const unacknowledged = allAlerts.filter((a) => !a.acknowledged);
  const critical = unacknowledged.filter((a) => a.severity === "critical");
  const warning = unacknowledged.filter((a) => a.severity === "warning");

  const storeMap = new Map<number, { storeName: string; unacknowledgedCount: number; criticalCount: number }>();
  for (const a of unacknowledged) {
    const existing = storeMap.get(a.storeId) ?? { storeName: a.storeName, unacknowledgedCount: 0, criticalCount: 0 };
    existing.unacknowledgedCount++;
    if (a.severity === "critical") existing.criticalCount++;
    storeMap.set(a.storeId, existing);
  }

  res.json({
    totalUnacknowledged: unacknowledged.length,
    criticalCount: critical.length,
    warningCount: warning.length,
    byStore: Array.from(storeMap.entries()).map(([storeId, data]) => ({
      storeId,
      storeName: data.storeName,
      unacknowledgedCount: data.unacknowledgedCount,
      criticalCount: data.criticalCount,
    })),
  });
});

router.delete("/alerts/:alertId", requireEmployeeAuth, async (req, res) => {
  const alertId = Number(req.params["alertId"]);

  const [existing] = await db
    .select({ storeId: alertsTable.storeId })
    .from(alertsTable)
    .where(eq(alertsTable.id, alertId));

  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  if (denyIfWrongStore(req, res, existing.storeId)) return;

  await db.delete(alertsTable).where(eq(alertsTable.id, alertId));
  res.json({ success: true, id: alertId });
});

router.patch("/alerts/:alertId/acknowledge", requireEmployeeAuth, async (req, res) => {
  const alertId = Number(req.params["alertId"]);

  const [existing] = await db
    .select({ storeId: alertsTable.storeId })
    .from(alertsTable)
    .where(eq(alertsTable.id, alertId));

  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  if (denyIfWrongStore(req, res, existing.storeId)) return;

  const [updated] = await db
    .update(alertsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date() })
    .where(eq(alertsTable.id, alertId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const [store] = await db
    .select({ name: storesTable.name })
    .from(storesTable)
    .where(eq(storesTable.id, updated.storeId));

  const [chemical] = await db
    .select({ name: chemicalsTable.name })
    .from(chemicalsTable)
    .where(eq(chemicalsTable.id, updated.chemicalId));

  res.json({
    ...updated,
    storeName: store?.name ?? "",
    chemicalName: chemical?.name ?? "",
    acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
