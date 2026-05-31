import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  storeId: integer("store_id").references(() => storesTable.id),
  role: text("role").notNull().default("employee"),
  active: boolean("active").notNull().default(true),
  sessionToken: text("session_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AppUser = typeof usersTable.$inferSelect;
