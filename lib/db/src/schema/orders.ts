import { pgTable, serial, integer, text, real, timestamp, date } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { chemicalsTable } from "./chemicals";

export const chemicalPullsTable = pgTable("chemical_pulls", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull().default("gallons"),
  pulledAt: timestamp("pulled_at").notNull().defaultNow(),
  initials: text("initials").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chemicalOrdersTable = pgTable("chemical_orders", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id),
  quantityOrdered: real("quantity_ordered").notNull(),
  unit: text("unit").notNull().default("gallons"),
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  status: text("status").notNull().default("pending"),
  poNumber: text("po_number"),
  orderedBy: text("ordered_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryReceivedTable = pgTable("inventory_received", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  chemicalId: integer("chemical_id").notNull().references(() => chemicalsTable.id),
  quantityReceived: real("quantity_received").notNull(),
  unit: text("unit").notNull().default("gallons"),
  receivedDate: date("received_date").notNull(),
  receivedBy: text("received_by"),
  poNumber: text("po_number"),
  orderId: integer("order_id").references(() => chemicalOrdersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
