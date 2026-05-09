const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  if (tokens.length === 0) return true;

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
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
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendAlertPush(
  tokens: string[],
  storeName: string,
  chemicalName: string,
  severity: string,
  direction: string,
  pctChange: number,
  extra?: Record<string, unknown>
): Promise<void> {
  if (tokens.length === 0) return;
  const dir = direction === "over" ? "High Usage" : "Low Quantity";
  const title = `[${severity.toUpperCase()}] ${storeName}`;
  const body = `${chemicalName}: ${dir} — ${Math.abs(pctChange).toFixed(1)}% change this week.`;
  await sendExpoPush(tokens, title, body, { severity, ...extra });
}
