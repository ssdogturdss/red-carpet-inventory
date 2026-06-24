import { Router } from "express";
import { requireEmployeeAuth } from "../lib/userAuth";
import { requireAdminPin } from "../lib/adminAuth";
import { db } from "@workspace/db";
import { notificationContactsTable, storesTable } from "@workspace/db";
import { eq, isNull, or } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "../services/email";
import { isSmsConfigured, sendSms } from "../services/sms";

const router = Router();

router.get("/notifications/contacts", requireAdminPin, async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;

  const rows = await db
    .select({
      id: notificationContactsTable.id,
      storeId: notificationContactsTable.storeId,
      storeName: storesTable.name,
      email: notificationContactsTable.email,
      phone: notificationContactsTable.phone,
      label: notificationContactsTable.label,
      active: notificationContactsTable.active,
      severity: notificationContactsTable.severity,
      createdAt: notificationContactsTable.createdAt,
    })
    .from(notificationContactsTable)
    .leftJoin(storesTable, eq(notificationContactsTable.storeId, storesTable.id))
    .where(
      storeId !== undefined
        ? or(eq(notificationContactsTable.storeId, storeId), isNull(notificationContactsTable.storeId))
        : undefined
    )
    .orderBy(notificationContactsTable.createdAt);

  res.json(rows.map((r) => ({
    ...r,
    storeName: r.storeName ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/notifications/contacts", requireAdminPin, async (req, res) => {
  const { storeId, email, phone, label, active, severity } = req.body as {
    storeId?: number | null;
    email?: string;
    phone?: string;
    label?: string;
    active?: boolean;
    severity?: string;
  };

  if (!email && !phone) {
    res.status(400).json({ error: "At least one of email or phone is required" });
    return;
  }

  const [contact] = await db
    .insert(notificationContactsTable)
    .values({
      storeId: storeId ?? null,
      email: email ?? null,
      phone: phone ?? null,
      label: label ?? "",
      active: active ?? true,
      severity: severity ?? "all",
    })
    .returning();

  if (!contact) {
    res.status(500).json({ error: "Failed to create contact" });
    return;
  }

  res.status(201).json({ ...contact, createdAt: contact.createdAt.toISOString() });
});

router.patch("/notifications/contacts/:id", requireAdminPin, async (req, res) => {
  const id = Number(req.params["id"]);
  const { email, phone, label, active, severity, storeId } = req.body as {
    email?: string | null;
    phone?: string | null;
    label?: string;
    active?: boolean;
    severity?: string;
    storeId?: number | null;
  };

  const updates: Partial<typeof notificationContactsTable.$inferInsert> = {};
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (label !== undefined) updates.label = label;
  if (active !== undefined) updates.active = active;
  if (severity !== undefined) updates.severity = severity;
  if (storeId !== undefined) updates.storeId = storeId;

  const [updated] = await db
    .update(notificationContactsTable)
    .set(updates)
    .where(eq(notificationContactsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/notifications/contacts/:id", requireAdminPin, async (req, res) => {
  const id = Number(req.params["id"]);
  await db.delete(notificationContactsTable).where(eq(notificationContactsTable.id, id));
  res.json({ success: true, id });
});

router.post("/notifications/contacts/:id/test", requireAdminPin, async (req, res) => {
  const id = Number(req.params["id"]);

  const [contact] = await db
    .select()
    .from(notificationContactsTable)
    .where(eq(notificationContactsTable.id, id));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const results: { channel: string; success: boolean; error?: string }[] = [];

  if (contact.email) {
    if (!isEmailConfigured()) {
      results.push({ channel: "email", success: false, error: "SMTP not configured" });
    } else {
      const r = await sendEmail(
        contact.email,
        "Red Carpet Inventory — Test Notification",
        `This is a test notification for "${contact.label || contact.email}".\n\nYour email alert notifications are active.`
      );
      results.push({ channel: "email", ...r });
    }
  }

  if (contact.phone) {
    if (!isSmsConfigured()) {
      results.push({ channel: "sms", success: false, error: "Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to your secrets." });
    } else {
      const r = await sendSms(
        contact.phone,
        `Red Carpet Inventory — Test\nThis is a test for "${contact.label || contact.phone}". Your SMS alerts are active.`
      );
      results.push({ channel: "sms", ...r });
    }
  }

  if (results.length === 0) {
    res.status(400).json({ success: false, error: "Contact has no email or phone configured" });
    return;
  }

  const anySuccess = results.some((r) => r.success);
  const errors = results.filter((r) => !r.success).map((r) => `${r.channel}: ${r.error}`);
  res.json({ success: anySuccess, error: errors.length > 0 ? errors.join("; ") : undefined });
});

router.get("/notifications/status", requireEmployeeAuth, async (_req, res) => {
  const emailConfigured = isEmailConfigured();
  const smsConfigured = isSmsConfigured();
  res.json({ configured: emailConfigured || smsConfigured, emailConfigured, smsConfigured });
});

export default router;
