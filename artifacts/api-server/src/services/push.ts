import { db } from "@workspace/db";
import { pushReceiptsTable, pushTokensTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export interface PushSendResult {
  ok: boolean;
  /** Successful tickets — maps Expo ticketId → device token for DB persistence */
  tickets: Array<{ ticketId: string; token: string }>;
  /** Tokens that Expo rejected immediately as DeviceNotRegistered */
  invalidTokens: string[];
}

type Logger = { warn: (obj: unknown, msg: string) => void };

async function checkPendingReceipts(log?: Logger): Promise<void> {
  const minAge = new Date(Date.now() - 30_000);
  let pendingReceipts: Array<{ id: number; ticketId: string; token: string }>;
  try {
    pendingReceipts = await db
      .select({ id: pushReceiptsTable.id, ticketId: pushReceiptsTable.ticketId, token: pushReceiptsTable.token })
      .from(pushReceiptsTable)
      .where(and(eq(pushReceiptsTable.status, "pending"), lt(pushReceiptsTable.sentAt, minAge)))
      .limit(100);
  } catch (err) {
    if (log) log.warn({ err }, "Failed to query pending push receipts (non-fatal)");
    return;
  }

  if (pendingReceipts.length === 0) return;

  const ticketIds = pendingReceipts.map((r) => r.ticketId);

  let receipts: Record<string, ExpoReceipt>;
  try {
    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({ ids: ticketIds }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (log) log.warn({ status: res.status }, "Expo receipts API returned non-OK status (will retry next send)");
      return;
    }

    const json = await res.json() as { data?: Record<string, ExpoReceipt> };
    receipts = json.data ?? {};
  } catch (err) {
    if (log) log.warn({ err }, "Failed to fetch Expo push receipts (will retry next send)");
    return;
  }

  const now = new Date();

  for (const pending of pendingReceipts) {
    const receipt = receipts[pending.ticketId];

    // If Expo has not yet produced a receipt for this ticket, leave it pending for retry
    if (receipt === undefined) continue;

    const errorCode = receipt.details?.error;

    if (receipt.status === "error") {
      if (log) {
        log.warn(
          { ticketId: pending.ticketId, token: pending.token, errorCode: errorCode ?? "unknown", message: receipt.message },
          `Expo push receipt error: ${errorCode ?? "unknown"}`
        );
      }
      if (errorCode === "DeviceNotRegistered") {
        try {
          await db.delete(pushTokensTable).where(eq(pushTokensTable.token, pending.token));
          if (log) log.warn({ token: pending.token }, "Removed DeviceNotRegistered push token via receipt check");
        } catch (err) {
          if (log) log.warn({ token: pending.token, err }, "Failed to remove stale push token (non-fatal)");
        }
      }
    }

    // Mark receipt as checked only after Expo confirmed it — never mark without a real response
    try {
      await db
        .update(pushReceiptsTable)
        .set({ status: receipt.status, errorCode: errorCode ?? null, checkedAt: now })
        .where(eq(pushReceiptsTable.ticketId, pending.ticketId));
    } catch (err) {
      if (log) log.warn({ ticketId: pending.ticketId, err }, "Failed to update push receipt status (non-fatal)");
    }
  }
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  opts?: { sound?: "default" | null; priority?: "default" | "normal" | "high" },
  log?: Logger
): Promise<PushSendResult> {
  if (tokens.length === 0) return { ok: true, tickets: [], invalidTokens: [] };

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: opts?.sound ?? "default",
    priority: opts?.priority ?? "high",
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return { ok: false, tickets: [], invalidTokens: [] };

    const json = await res.json() as { data?: ExpoTicket[] };
    const rawTickets: ExpoTicket[] = json.data ?? [];

    const tickets: Array<{ ticketId: string; token: string }> = [];
    const invalidTokens: string[] = [];

    rawTickets.forEach((ticket, i) => {
      const token = tokens[i];
      if (ticket.status === "ok" && ticket.id) {
        tickets.push({ ticketId: ticket.id, token: token ?? "" });
      } else if (ticket.status === "error") {
        const errorCode = ticket.details?.error ?? "unknown";
        log?.warn(
          { errorCode, message: ticket.message, token },
          `Expo push ticket error: ${errorCode}`
        );
        if (errorCode === "DeviceNotRegistered" && token) {
          invalidTokens.push(token);
        }
      }
    });

    // Check receipts from previous sends (on-next-send pattern) — non-blocking
    void checkPendingReceipts(log);

    return { ok: true, tickets, invalidTokens };
  } catch {
    return { ok: false, tickets: [], invalidTokens: [] };
  }
}

export async function sendAlertPush(
  tokens: string[],
  storeName: string,
  chemicalName: string,
  severity: "warning" | "critical" | string,
  direction: "over" | "under" | string,
  pctChange: number,
  extra?: Record<string, unknown>,
  log?: Logger
): Promise<PushSendResult> {
  if (tokens.length === 0) return { ok: true, tickets: [], invalidTokens: [] };

  const dirLabel = direction === "over" ? "high usage" : "low quantity";
  const isCritical = severity === "critical";

  const title = isCritical
    ? `🚨 Critical: ${storeName}`
    : `⚠️ Warning: ${storeName}`;

  const body = `${chemicalName} — ${dirLabel} (${Math.abs(pctChange).toFixed(1)}% change)`;

  return sendExpoPush(
    tokens,
    title,
    body,
    { severity, direction, storeName, chemicalName, tab: "admin", ...extra },
    {
      sound: isCritical ? "default" : null,
      priority: isCritical ? "high" : "normal",
    },
    log
  );
}
