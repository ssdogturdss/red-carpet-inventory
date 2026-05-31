import { db } from "@workspace/db";
import { pushReceiptsTable, pushTokensTable } from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { EXPO_RECEIPTS_URL, type ExpoReceipt } from "./push";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_AGE_MS = 5 * 60 * 1000;        // receipts ready after ~5 min
const BATCH_SIZE = 300;                   // Expo allows up to 300 IDs per request

async function pollReceipts() {
  try {
    const cutoff = new Date(Date.now() - MIN_AGE_MS);

    const pending = await db
      .select({
        id: pushReceiptsTable.id,
        ticketId: pushReceiptsTable.ticketId,
        token: pushReceiptsTable.token,
      })
      .from(pushReceiptsTable)
      .where(
        and(
          eq(pushReceiptsTable.status, "pending"),
          lt(pushReceiptsTable.sentAt, cutoff)
        )
      )
      .limit(BATCH_SIZE);

    if (pending.length === 0) return;

    logger.info({ count: pending.length }, "Polling Expo push receipts");

    const ticketIds = pending.map((r) => r.ticketId);

    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({ ids: ticketIds }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo receipts API returned non-200");
      return;
    }

    const json = await res.json() as { data?: Record<string, ExpoReceipt> };
    const receipts = json.data ?? {};
    const checkedAt = new Date();

    // Collect tokens to remove for DeviceNotRegistered errors
    const tokensToRemove: string[] = [];

    for (const row of pending) {
      const receipt = receipts[row.ticketId];
      if (!receipt) continue; // not ready yet — leave as pending

      const status = receipt.status === "ok" ? "ok" : "error";
      const errorCode = receipt.status === "error"
        ? (receipt.details?.error ?? "unknown")
        : null;

      await db
        .update(pushReceiptsTable)
        .set({ status, errorCode, checkedAt })
        .where(eq(pushReceiptsTable.id, row.id));

      if (status === "error") {
        logger.warn(
          { ticketId: row.ticketId, errorCode, token: row.token },
          `Push receipt error: ${errorCode}`
        );
        if (errorCode === "DeviceNotRegistered") {
          tokensToRemove.push(row.token);
        }
      }
    }

    // Bulk-remove stale tokens
    if (tokensToRemove.length > 0) {
      await db
        .delete(pushTokensTable)
        .where(inArray(pushTokensTable.token, tokensToRemove));
      logger.warn(
        { count: tokensToRemove.length },
        "Removed DeviceNotRegistered push tokens (from receipt check)"
      );
    }

    logger.info({ checked: Object.keys(receipts).length }, "Receipt poll complete");
  } catch (err) {
    logger.warn({ err }, "Push receipt poll failed (non-fatal)");
  }
}

export function startPushReceiptPoller() {
  // Run once shortly after startup to catch any receipts from a previous run
  setTimeout(() => { void pollReceipts(); }, 2 * 60 * 1000); // 2 min after boot
  // Then poll on the regular interval
  setInterval(() => { void pollReceipts(); }, POLL_INTERVAL_MS);
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Push receipt poller started");
}
