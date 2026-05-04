import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/reports/chemicals", async (_req, res) => {
  const rows = await db.execute(sql`
    WITH latest_counts AS (
      SELECT DISTINCT ON (store_id)
        id, store_id, week_of
      FROM inventory_counts
      ORDER BY store_id, submitted_at DESC
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
      lc.week_of,
      EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.store_id = s.id
          AND a.chemical_id = c.id
          AND a.acknowledged = false
      ) AS has_alert
    FROM chemicals c
    CROSS JOIN stores s
    LEFT JOIN latest_counts lc ON lc.store_id = s.id
    LEFT JOIN inventory_entries ie
           ON ie.count_id = lc.id AND ie.chemical_id = c.id
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
    map.get(cid)!.stores.push({
      storeId: Number(row.store_id),
      storeName: row.store_name,
      storeNumber: row.store_number,
      latestQuantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null,
      weekOf: row.week_of ?? null,
      hasAlert,
    });
  }

  res.json(Array.from(map.values()));
});

export default router;
