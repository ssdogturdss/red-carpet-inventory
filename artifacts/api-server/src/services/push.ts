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
  data?: Record<string, unknown>,
  opts?: { sound?: "default" | null; priority?: "default" | "normal" | "high" }
): Promise<boolean> {
  if (tokens.length === 0) return true;

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

    if (res.ok) {
      try {
        const json = await res.json() as { data?: Array<{ status: string; message?: string }> };
        const failures = (json.data ?? []).filter((r) => r.status !== "ok");
        if (failures.length > 0) {
          console.warn("Expo push partial failures:", failures);
        }
      } catch {
      }
    }

    return res.ok;
  } catch {
    return false;
  }
}

export async function sendAlertPush(
  tokens: string[],
  storeName: string,
  chemicalName: string,
  severity: "warning" | "critical" | string,
  direction: "over" | "under" | string,
  pctChange: number,
  extra?: Record<string, unknown>
): Promise<void> {
  if (tokens.length === 0) return;

  const dirLabel = direction === "over" ? "high usage" : "low quantity";
  const isCritical = severity === "critical";

  const title = isCritical
    ? `🚨 Critical: ${storeName}`
    : `⚠️ Warning: ${storeName}`;

  const body = `${chemicalName} — ${dirLabel} (${Math.abs(pctChange).toFixed(1)}% change)`;

  await sendExpoPush(
    tokens,
    title,
    body,
    { severity, direction, storeName, chemicalName, tab: "admin", ...extra },
    {
      sound: isCritical ? "default" : null,
      priority: isCritical ? "high" : "normal",
    }
  );
}
