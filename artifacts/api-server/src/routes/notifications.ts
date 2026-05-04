import { Router } from "express";
import { db } from "@workspace/db";
import { notificationContactsTable, storesTable } from "@workspace/db";
import { eq, isNull, or } from "drizzle-orm";
import { isEmailConfigured, sendEmail } from "../services/email";

const router = Router();

router.get("/notifications/contacts", async (req, res) => {
  const storeId = req.query["storeId"] ? Number(req.query["storeId"]) : undefined;

  const rows = await db
    .select({
      id: notificationContactsTable.id,
      storeId: notificationContactsTable.storeId,
      storeName: storesTable.name,
      email: notificationContactsTable.email,
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

router.post("/notifications/contacts", async (req, res) => {
  const { storeId, email, label, active, severity } = req.body as {
    storeId?: number | null;
    email: string;
    label?: string;
    active?: boolean;
    severity?: string;
  };

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const [contact] = await db
    .insert(notificationContactsTable)
    .values({
      storeId: storeId ?? null,
      email,
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

router.patch("/notifications/contacts/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { email, label, active, severity, storeId } = req.body as {
    email?: string;
    label?: string;
    active?: boolean;
    severity?: string;
    storeId?: number | null;
  };

  const updates: Partial<typeof notificationContactsTable.$inferInsert> = {};
  if (email !== undefined) updates.email = email;
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

router.delete("/notifications/contacts/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  await db.delete(notificationContactsTable).where(eq(notificationContactsTable.id, id));
  res.json({ success: true, id });
});

router.post("/notifications/contacts/:id/test", async (req, res) => {
  const id = Number(req.params["id"]);

  const [contact] = await db
    .select()
    .from(notificationContactsTable)
    .where(eq(notificationContactsTable.id, id));

  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(400).json({ error: "Email not configured — add SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM to your secrets." });
    return;
  }

  const result = await sendEmail(
    contact.email,
    "Red Carpet Inventory — Test Notification",
    `This is a test notification for "${contact.label || contact.email}".\n\nYour email alert notifications are active.`
  );

  res.json(result);
});

router.get("/notifications/status", async (_req, res) => {
  res.json({ configured: isEmailConfigured() });
});

export default router;
