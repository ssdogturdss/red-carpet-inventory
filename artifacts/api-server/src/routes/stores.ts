import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/stores", async (req, res) => {
  const stores = await db.select().from(storesTable).orderBy(asc(storesTable.storeNumber));
  res.json(stores.map((s) => ({ id: s.id, name: s.name, storeNumber: s.storeNumber })));
});

export default router;
