import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

export function isSmsConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

/**
 * Normalize a phone number to E.164 format required by Twilio.
 * Handles common formats: 10-digit US, 11-digit with leading 1, already E.164.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw.trim();
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!isSmsConfigured()) {
    return { success: false, error: "Twilio credentials not configured" };
  }
  const normalizedTo = normalizePhone(to);
  const timeoutMs = 10_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Twilio request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  );
  try {
    const client = twilio(accountSid, authToken);
    await Promise.race([
      client.messages.create({ from: fromNumber, to: normalizedTo, body }),
      timeout,
    ]);
    return { success: true };
  } catch (err: any) {
    const code: number | undefined = err?.code;
    const status: number | undefined = err?.status;
    const detail = [err?.message, code ? `code=${code}` : undefined, status ? `status=${status}` : undefined]
      .filter(Boolean)
      .join(" | ");
    return { success: false, error: detail || "Unknown error" };
  }
}

export async function sendAlertSms(contacts: string[], storeName: string, chemicalName: string, severity: string, direction: string, pctChange: number): Promise<void> {
  if (!isSmsConfigured() || contacts.length === 0) return;
  const dir = direction === "over" ? "high usage" : "low quantity";
  const body = `🚨 Red Carpet Alert [${severity.toUpperCase()}]\nStore: ${storeName}\nProduct: ${chemicalName}\n${dir}: ${Math.abs(pctChange).toFixed(1)}% change this week.`;
  await Promise.allSettled(contacts.map((to) => sendSms(to, body)));
}
