import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

export function isSmsConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!isSmsConfigured()) {
    return { success: false, error: "Twilio credentials not configured" };
  }
  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from: fromNumber, to, body });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

export async function sendAlertSms(contacts: string[], storeName: string, chemicalName: string, severity: string, direction: string, pctChange: number): Promise<void> {
  if (!isSmsConfigured() || contacts.length === 0) return;
  const dir = direction === "over" ? "high usage" : "low quantity";
  const body = `🚨 Red Carpet Alert [${severity.toUpperCase()}]\nStore: ${storeName}\nProduct: ${chemicalName}\n${dir}: ${Math.abs(pctChange).toFixed(1)}% change this week.`;
  await Promise.allSettled(contacts.map((to) => sendSms(to, body)));
}
