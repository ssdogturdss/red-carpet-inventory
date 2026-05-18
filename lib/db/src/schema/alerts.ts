import { pgTable, serial, integer, real, text, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";
import { chemicalsTable } from "./chemicals";

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id),
  weekOf: date("week_of").notNull(),
  previousQuantity: real("previous_quantity").notNull(),
  currentQuantity: real("current_quantity").notNull(),
  percentChange: real("percent_change").notNull(),
  direction: text("direction").notNull().$type<"over" | "under">(),
  severity: text("severity").notNull().$type<"warning" | "critical">(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
