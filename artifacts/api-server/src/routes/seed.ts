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
  { name: "Chlorine", unit: "gallons", thresholdPercent: 25 },
  { name: "pH Plus", unit: "lbs", thresholdPercent: 30 },
  { name: "pH Minus", unit: "lbs", thresholdPercent: 30 },
  { name: "Alkalinity Up", unit: "lbs", thresholdPercent: 30 },
  { name: "Calcium Hardness", unit: "lbs", thresholdPercent: 35 },
  { name: "Cyanuric Acid", unit: "lbs", thresholdPercent: 40 },
  { name: "Algaecide", unit: "gallons", thresholdPercent: 30 },
  { name: "Clarifier", unit: "gallons", thresholdPercent: 35 },
  { name: "Shock (Cal-Hypo)", unit: "lbs", thresholdPercent: 25 },
  { name: "Bromine", unit: "lbs", thresholdPercent: 25 },
  { name: "Muriatic Acid", unit: "gallons", thresholdPercent: 30 },
  { name: "Sodium Bicarbonate", unit: "lbs", thresholdPercent: 30 },
  { name: "Sodium Carbonate", unit: "lbs", thresholdPercent: 30 },
  { name: "Potassium Peroxymonosulfate", unit: "lbs", thresholdPercent: 35 },
  { name: "Copper Sulfate", unit: "lbs", thresholdPercent: 40 },
  { name: "Quaternary Ammonium", unit: "gallons", thresholdPercent: 30 },
  { name: "Sodium Hypochlorite", unit: "gallons", thresholdPercent: 25 },
  { name: "Diatomaceous Earth", unit: "lbs", thresholdPercent: 35 },
  { name: "Filter Aid", unit: "gallons", thresholdPercent: 35 },
  { name: "Metal Sequestrant", unit: "gallons", thresholdPercent: 40 },
  { name: "Enzyme Treatment", unit: "gallons", thresholdPercent: 35 },
  { name: "Phosphate Remover", unit: "gallons", thresholdPercent: 40 },
  { name: "Defoamer", unit: "gallons", thresholdPercent: 40 },
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
