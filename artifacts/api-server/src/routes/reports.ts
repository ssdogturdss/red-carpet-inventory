import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /reports/chemicals ───────────────────────────────────────────────────
router.get("/reports/chemicals", async (req, res) => {
  const weekOf = req.query.weekOf as string | undefined;

  const rows = await db.execute(sql`
    WITH selected_counts AS (
      SELECT DISTINCT ON (store_id)
        id, store_id, week_of
      FROM inventory_counts
      ${weekOf ? sql`WHERE week_of <= ${weekOf}::date` : sql``}
      ORDER BY store_id, week_of DESC
    ),
    previous_counts AS (
      SELECT DISTINCT ON (ic.store_id)
        ic.id, ic.store_id, ic.week_of
      FROM inventory_counts ic
      JOIN selected_counts sc ON ic.store_id = sc.store_id
      WHERE ic.week_of < sc.week_of
      ORDER BY ic.store_id, ic.week_of DESC
    )
    SELECT
      c.id              AS chemical_id,
      c.name            AS chemical_name,
      c.unit,
      c.threshold_percent,
      s.id              AS store_id,
      s.name            AS store_name,
      s.store_number,
      ie.quantity,
      sc.week_of,
      pie.quantity      AS previous_quantity,
      pc.week_of        AS previous_week_of,
      EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.store_id = s.id
          AND a.chemical_id = c.id
          AND a.acknowledged = false
      ) AS has_alert
    FROM chemicals c
    CROSS JOIN stores s
    LEFT JOIN selected_counts sc ON sc.store_id = s.id
    LEFT JOIN inventory_entries ie ON ie.count_id = sc.id AND ie.chemical_id = c.id
    LEFT JOIN previous_counts pc ON pc.store_id = s.id
    LEFT JOIN inventory_entries pie ON pie.count_id = pc.id AND pie.chemical_id = c.id
    ORDER BY c.name, s.name
  `);

  const map = new Map<number, {
    chemicalId: number;
    chemicalName: string;
    unit: string;
    alertThresholdPercent: number;
    stores: {
      storeId: number;
      storeName: string;
      storeNumber: string;
      latestQuantity: number | null;
      weekOf: string | null;
      previousQuantity: number | null;
      changePercent: number | null;
      previousWeekOf: string | null;
      hasAlert: boolean;
    }[];
  }>();

  for (const row of rows.rows as any[]) {
    const cid = Number(row.chemical_id);
    if (!map.has(cid)) {
      map.set(cid, {
        chemicalId: cid,
        chemicalName: row.chemical_name,
        unit: row.unit,
        alertThresholdPercent: Number(row.threshold_percent),
        stores: [],
      });
    }
    const hasAlert = row.has_alert === true || row.has_alert === "t" || row.has_alert === 1;
    const qty = row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null;
    const prevQty = row.previous_quantity !== null && row.previous_quantity !== undefined ? Number(row.previous_quantity) : null;
    let changePercent: number | null = null;
    if (qty !== null && prevQty !== null && prevQty !== 0) {
      changePercent = Math.round(((qty - prevQty) / prevQty) * 1000) / 10;
    }
    map.get(cid)!.stores.push({
      storeId: Number(row.store_id),
      storeName: row.store_name,
      storeNumber: row.store_number,
      latestQuantity: qty,
      weekOf: row.week_of ?? null,
      previousQuantity: prevQty,
      changePercent,
      previousWeekOf: row.previous_week_of ?? null,
      hasAlert,
    });
  }

  res.json(Array.from(map.values()));
});

// ─── GET /reports/store/:storeId ──────────────────────────────────────────────
router.get("/reports/store/:storeId", async (req, res) => {
  const storeId = Number(req.params.storeId);
  const weekOf = req.query.weekOf as string | undefined;

  const storeRows = await db.execute(sql`
    SELECT id, name, store_number FROM stores WHERE id = ${storeId}
  `);
  if (!storeRows.rows.length) {
    res.status(404).json({ error: "Store not found" });
    return;
  }
  const store = storeRows.rows[0] as any;

  const rows = await db.execute(sql`
    WITH selected_count AS (
      SELECT id, week_of
      FROM inventory_counts
      WHERE store_id = ${storeId}
        ${weekOf ? sql`AND week_of <= ${weekOf}::date` : sql``}
      ORDER BY week_of DESC
      LIMIT 1
    ),
    previous_count AS (
      SELECT id, week_of
      FROM inventory_counts
      WHERE store_id = ${storeId}
        AND week_of < COALESCE((SELECT week_of FROM selected_count), 'infinity'::date)
      ORDER BY week_of DESC
      LIMIT 1
    )
    SELECT
      c.id              AS chemical_id,
      c.name            AS chemical_name,
      c.unit,
      c.threshold_percent,
      sc.week_of,
      ie.quantity,
      pie.quantity      AS previous_quantity,
      EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.store_id = ${storeId}
          AND a.chemical_id = c.id
          AND a.acknowledged = false
      ) AS has_alert
    FROM chemicals c
    LEFT JOIN selected_count sc ON true
    LEFT JOIN inventory_entries ie ON ie.count_id = sc.id AND ie.chemical_id = c.id
    LEFT JOIN previous_count pc ON true
    LEFT JOIN inventory_entries pie ON pie.count_id = pc.id AND pie.chemical_id = c.id
    ORDER BY c.name
  `);

  const weekOfResult = (rows.rows[0] as any)?.week_of ?? null;
  const chemicals = (rows.rows as any[]).map((row) => {
    const qty = row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null;
    const prevQty = row.previous_quantity !== null && row.previous_quantity !== undefined ? Number(row.previous_quantity) : null;
    let changePercent: number | null = null;
    if (qty !== null && prevQty !== null && prevQty !== 0) {
      changePercent = Math.round(((qty - prevQty) / prevQty) * 1000) / 10;
    }
    const hasAlert = row.has_alert === true || row.has_alert === "t" || row.has_alert === 1;
    return {
      chemicalId: Number(row.chemical_id),
      chemicalName: row.chemical_name,
      unit: row.unit,
      alertThresholdPercent: Number(row.threshold_percent),
      quantity: qty,
      previousQuantity: prevQty,
      changePercent,
      hasAlert,
    };
  });

  res.json({
    storeId,
    storeName: store.name,
    storeNumber: store.store_number,
    weekOf: weekOfResult,
    chemicals,
  });
});

// ─── GET /reports/missing-submissions ────────────────────────────────────────
router.get("/reports/missing-submissions", async (_req, res) => {
  const rows = await db.execute(sql`
    WITH current_week AS (
      SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
    ),
    latest_per_store AS (
      SELECT DISTINCT ON (store_id)
        store_id, week_of
      FROM inventory_counts
      ORDER BY store_id, week_of DESC
    )
    SELECT
      s.id              AS store_id,
      s.name            AS store_name,
      s.store_number,
      lps.week_of       AS last_submitted_week_of,
      CASE
        WHEN lps.week_of IS NULL THEN NULL
        ELSE ((SELECT week_start FROM current_week) - lps.week_of) / 7
      END               AS weeks_since_last
    FROM stores s
    LEFT JOIN latest_per_store lps ON lps.store_id = s.id
    WHERE lps.week_of IS NULL
       OR lps.week_of < (SELECT week_start FROM current_week)
    ORDER BY s.name
  `);

  res.json((rows.rows as any[]).map((row) => ({
    storeId: Number(row.store_id),
    storeName: row.store_name,
    storeNumber: row.store_number,
    lastSubmittedWeekOf: row.last_submitted_week_of ?? null,
    weeksSinceLast: row.weeks_since_last !== null && row.weeks_since_last !== undefined
      ? Number(row.weeks_since_last)
      : null,
  })));
});

// ─── GET /reports/trend ───────────────────────────────────────────────────────
router.get("/reports/trend", async (req, res) => {
  const chemicalId = Number(req.query.chemicalId);
  const weeks = Math.min(Number(req.query.weeks ?? 8), 26);
  const storeId = req.query.storeId ? Number(req.query.storeId) : null;

  if (!chemicalId) {
    res.status(400).json({ error: "chemicalId is required" });
    return;
  }

  const rows = await db.execute(sql`
    SELECT
      ic.week_of,
      COALESCE(SUM(ie.quantity), 0)::numeric          AS total_quantity,
      COUNT(DISTINCT ic.store_id)::int                AS store_count
    FROM inventory_counts ic
    JOIN inventory_entries ie
      ON ie.count_id = ic.id
     AND ie.chemical_id = ${chemicalId}
    ${storeId ? sql`WHERE ic.store_id = ${storeId}` : sql``}
    GROUP BY ic.week_of
    ORDER BY ic.week_of ASC
    LIMIT ${weeks}
  `);

  res.json(
    (rows.rows as any[]).map((r) => ({
      weekOf: r.week_of instanceof Date ? r.week_of.toISOString().split("T")[0] : String(r.week_of),
      totalQuantity: Number(r.total_quantity),
      storeCount: Number(r.store_count),
    }))
  );
});

export default router;
