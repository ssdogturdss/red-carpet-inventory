import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const notificationContactsTable = pgTable("notification_contacts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => storesTable.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  label: text("label").notNull().default(""),
  active: boolean("active").notNull().default(true),
  severity: text("severity").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationContactSchema = createInsertSchema(notificationContactsTable).omit({ id: true, createdAt: true });
export type InsertNotificationContact = z.infer<typeof insertNotificationContactSchema>;
export type NotificationContact = typeof notificationContactsTable.$inferSelect;
