import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botName: text("bot_name").notNull().default("Report Bot"),
  greeting: text("greeting").notNull().default(
    "Hi! I'm your Report Bot. Ask me anything about your chemical inventory — usage trends, alerts, store comparisons, deliveries, and more. I'll pull live data and summarize it for you.",
  ),
  systemPromptExtra: text("system_prompt_extra").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const updateBotSettingsSchema = createInsertSchema(botSettingsTable)
  .omit({ id: true, updatedAt: true })
  .partial();

export type BotSettings = typeof botSettingsTable.$inferSelect;
export type UpdateBotSettings = z.infer<typeof updateBotSettingsSchema>;
