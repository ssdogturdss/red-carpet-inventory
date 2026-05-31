const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export interface PushSendResult {
  ok: boolean;
  ticketIds: string[];
  invalidTokens: string[];
}

async function checkReceipts(ticketIds: string[], logger?: { warn: (obj: unknown, msg: string) => void }): Promise<void> {
  if (ticketIds.length === 0) return;
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

    if (!res.ok) return;

    const json = await res.json() as { data?: Record<string, ExpoReceipt> };
    const receipts = json.data ?? {};

    for (const [ticketId, receipt] of Object.entries(receipts)) {
      if (receipt.status === "error") {
        const errorCode = receipt.details?.error ?? "unknown";
        if (logger) {
          logger.warn(
            { ticketId, errorCode, message: receipt.message },
            `Expo push receipt error: ${errorCode}`
          );
        } else {
          console.warn(`Expo push receipt error [${ticketId}]: ${errorCode} — ${receipt.message ?? ""}`);
        }
      }
    }
  } catch {
  }
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  opts?: { sound?: "default" | null; priority?: "default" | "normal" | "high" },
  logger?: { warn: (obj: unknown, msg: string) => void }
): Promise<PushSendResult> {
  if (tokens.length === 0) return { ok: true, ticketIds: [], invalidTokens: [] };

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

    if (!res.ok) return { ok: false, ticketIds: [], invalidTokens: [] };

    const json = await res.json() as { data?: ExpoTicket[] };
    const tickets: ExpoTicket[] = json.data ?? [];

    const ticketIds: string[] = [];
    const invalidTokens: string[] = [];

    tickets.forEach((ticket, i) => {
      if (ticket.status === "ok" && ticket.id) {
        ticketIds.push(ticket.id);
      } else if (ticket.status === "error") {
        const errorCode = ticket.details?.error ?? "unknown";
        const token = tokens[i];
        if (logger) {
          logger.warn(
            { errorCode, message: ticket.message, token },
            `Expo push ticket error: ${errorCode}`
          );
        } else {
          console.warn(`Expo push ticket error: ${errorCode} — ${ticket.message ?? ""}`);
        }
        if (errorCode === "DeviceNotRegistered" && token) {
          invalidTokens.push(token);
        }
      }
    });

    // Fire-and-forget receipt check after a short delay (non-blocking)
    if (ticketIds.length > 0) {
      setTimeout(() => {
        void checkReceipts(ticketIds, logger);
      }, 5_000);
    }

    return { ok: true, ticketIds, invalidTokens };
  } catch {
    return { ok: false, ticketIds: [], invalidTokens: [] };
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
  logger?: { warn: (obj: unknown, msg: string) => void }
): Promise<PushSendResult> {
  if (tokens.length === 0) return { ok: true, ticketIds: [], invalidTokens: [] };

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
    logger
  );
}
