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
