import { pgTable, serial, integer, text, real, timestamp, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";
import { chemicalsTable } from "./chemicals";
import { usersTable } from "./users";

export const inventoryCountsTable = pgTable("inventory_counts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  weekOf: date("week_of").notNull(),
  submittedBy: text("submitted_by").notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const inventoryEntriesTable = pgTable("inventory_entries", {
  id: serial("id").primaryKey(),
  countId: integer("count_id").notNull().references(() => inventoryCountsTable.id),
  chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id),
  quantity: real("quantity").notNull(),
});

export const insertInventoryCountSchema = createInsertSchema(inventoryCountsTable).omit({ id: true, submittedAt: true });
export type InsertInventoryCount = z.infer<typeof insertInventoryCountSchema>;
export type InventoryCount = typeof inventoryCountsTable.$inferSelect;

export const insertInventoryEntrySchema = createInsertSchema(inventoryEntriesTable).omit({ id: true });
export type InsertInventoryEntry = z.infer<typeof insertInventoryEntrySchema>;
export type InventoryEntry = typeof inventoryEntriesTable.$inferSelect;

export const inventoryOnHandTable = pgTable(
  "inventory_on_hand",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
    chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull().default(0),
    unit: text("unit").notNull().default("gallons"),
    source: text("source").notNull().default("count"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("uq_on_hand_store_chemical").on(t.storeId, t.chemicalId)]
);
