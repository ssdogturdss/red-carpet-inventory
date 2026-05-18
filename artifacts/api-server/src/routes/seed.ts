import { db } from "@workspace/db";
import { storesTable, chemicalsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const STORES = [
  { name: "FIG", storeNumber: "001" },
  { name: "PBL", storeNumber: "002" },
  { name: "FBL", storeNumber: "003" },
  { name: "WIN", storeNumber: "004" },
  { name: "FWL", storeNumber: "005" },
  { name: "202", storeNumber: "006" },
  { name: "KCC", storeNumber: "007" },
  { name: "TUL", storeNumber: "008" },
  { name: "CLO", storeNumber: "009" },
  { name: "RED", storeNumber: "010" },
  { name: "FRE", storeNumber: "011" },
];

const CHEMICALS = [
  { name: "Foamed BWS 1000-33", unit: "gallons", thresholdPercent: 25 },
  { name: "NA", unit: "gallons", thresholdPercent: 30 },
  { name: "NA", unit: "gallons", thresholdPercent: 30 },
  { name: "Bulldog BWS 19", unit: "gallons", thresholdPercent: 30 },
  { name: "Low PH Citrus Foamy Lube BWS 101", unit: "gallons", thresholdPercent: 35 },
  { name: "Lava Wax Great BWS 100", unit: "gallons", thresholdPercent: 40 },
  { name: "Bug BWS 61", unit: "gallons", thresholdPercent: 30 },
  { name: "Best Red Polish BWS 54", unit: "gallons", thresholdPercent: 35 },
  { name: "NA", unit: "gallons", thresholdPercent: 25 },
  { name: "Presoak BWS 1000-33 CS", unit: "gallons", thresholdPercent: 25 },
  { name: "TVP for Wheels", unit: "gallons", thresholdPercent: 30 },
  { name: "NA", unit: "gallons", thresholdPercent: 30 },
  { name: "NA", unit: "gallons", thresholdPercent: 30 },
  { name: "Tub Soap BWS 36", unit: "gallons", thresholdPercent: 35 },
  { name: "Platinum Blue Polish BWS 1000-56", unit: "gallons", thresholdPercent: 40 },
  { name: "NA", unit: "gallons", thresholdPercent: 30 },
  { name: "NA", unit: "gallons", thresholdPercent: 25 },
  { name: "Ceramic Shield 102", unit: "gallons", thresholdPercent: 35 },
  { name: "Ceramic Detail BWS 582", unit: "gallons", thresholdPercent: 35 },
  { name: "Rain Shield RCW4", unit: "gallons", thresholdPercent: 40 },
  { name: "Triple Shine BWS 88", unit: "gallons", thresholdPercent: 35 },
  { name: "Trying Agent BWS 62", unit: "gallons", thresholdPercent: 40 },
  { name: "Purple Polish BWS 95", unit: "gallons", thresholdPercent: 40 },
];

export async function seedDatabase() {
  try {
    const existingStores = await db.select().from(storesTable).limit(1);
    if (existingStores.length === 0) {
      await db.insert(storesTable).values(STORES);
      logger.info("Seeded stores");
    }

    const existingChemicals = await db.select().from(chemicalsTable).limit(1);
    if (existingChemicals.length === 0) {
      await db.insert(chemicalsTable).values(CHEMICALS);
      logger.info("Seeded chemicals");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed database");
  }
}
