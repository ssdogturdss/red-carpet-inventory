import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const pushTicketsTable = pgTable("push_tickets", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
});

export type PushTicket = typeof pushTicketsTable.$inferSelect;
