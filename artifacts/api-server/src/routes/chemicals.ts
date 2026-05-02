import { Router } from "express";
import { db } from "@workspace/db";
import { chemicalsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/chemicals", async (req, res) => {
  const chemicals = await db.select().from(chemicalsTable).orderBy(asc(chemicalsTable.name));
  res.json(
    chemicals.map((c) => ({
      id: c.id,
      name: c.name,
      unit: c.unit,
      thresholdPercent: c.thresholdPercent,
    }))
  );
});

export default router;
