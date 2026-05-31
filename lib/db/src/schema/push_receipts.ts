import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { alertsTable } from "./alerts";

export const pushReceiptsTable = pgTable("push_receipts", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(),
  token: text("token").notNull(),
  alertId: integer("alert_id").references(() => alertsTable.id, { onDelete: "set null" }),
  storeName: text("store_name").notNull().default(""),
  chemicalName: text("chemical_name").notNull().default(""),
  severity: text("severity").notNull().default("warning"),
  status: text("status").notNull().default("pending").$type<"pending" | "ok" | "error">(),
  errorCode: text("error_code"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  checkedAt: timestamp("checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushReceipt = typeof pushReceiptsTable.$inferSelect;
