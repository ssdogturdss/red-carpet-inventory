import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? user;

export function isEmailConfigured(): boolean {
  return !!(host && user && pass);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: "Email credentials not configured" };
  }
  const timeoutMs = 10_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`SMTP request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  );
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });
    await Promise.race([transporter.sendMail({ from, to, subject, text: body }), timeout]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

export async function sendAlertEmail(
  recipients: string[],
  storeName: string,
  chemicalName: string,
  severity: string,
  direction: string,
  pctChange: number
): Promise<void> {
  if (!isEmailConfigured() || recipients.length === 0) return;
  const dir = direction === "over" ? "high usage" : "low usage";
  const subject = `Red Carpet Alert [${severity.toUpperCase()}] — ${storeName}`;
  const body = `Red Carpet Inventory Alert\n\nStore: ${storeName}\nProduct: ${chemicalName}\nSeverity: ${severity.toUpperCase()}\nIssue: ${dir} — ${Math.abs(pctChange).toFixed(1)}% change this week.\n\nLog in to review and acknowledge this alert.`;
  await Promise.allSettled(recipients.map((to) => sendEmail(to, subject, body)));
}
