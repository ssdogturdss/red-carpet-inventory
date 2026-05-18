import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chemicalsTable = pgTable("chemicals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("gallons"),
  thresholdPercent: real("threshold_percent").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChemicalSchema = createInsertSchema(chemicalsTable).omit({ id: true, createdAt: true });
export type InsertChemical = z.infer<typeof insertChemicalSchema>;
export type Chemical = typeof chemicalsTable.$inferSelect;
