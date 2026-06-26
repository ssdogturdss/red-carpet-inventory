import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { verifyAdminPin } from "./adminAuth";

const USER_TOKEN_HEADER = "x-user-token";
const ADMIN_PIN_HEADER = "x-admin-pin";

/**
 * Express middleware that requires a valid employee session token.
 * Validates the x-user-token header, loads the user from DB, and attaches
 * req.user = { id, role, storeId } for downstream authorization checks.
 * Returns 401 if the token is missing or invalid.
 */
export async function requireEmployeeAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // A valid admin PIN satisfies employee auth with full admin privileges.
  const adminPin = req.headers[ADMIN_PIN_HEADER] as string | undefined;
  if (adminPin) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const check = verifyAdminPin(adminPin, ip);
    if (check.result === "ok") {
      req.user = { id: 0, role: "admin", storeId: null };
      next();
      return;
    }
  }

  const token = req.headers[USER_TOKEN_HEADER] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, storeId: usersTable.storeId })
    .from(usersTable)
    .where(and(eq(usersTable.sessionToken, token), eq(usersTable.active, true)));

  if (!user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.user = { id: user.id, role: user.role, storeId: user.storeId ?? null };
  next();
}

/** Returns true if the authenticated user has the admin role. */
export function isAdmin(req: Request): boolean {
  return req.user?.role === "admin";
}

/**
 * For non-admin employees, returns their assigned storeId.
 * For admins, returns the requested storeId (may be null = all stores).
 * Returns null when the employee has no assigned store.
 */
export function scopedStoreId(req: Request, requested?: number | null): number | null {
  if (isAdmin(req)) return requested ?? null;
  return req.user?.storeId ?? null;
}

/**
 * Sends 403 if the employee is not an admin and their storeId does not match
 * the record's storeId. Returns true if access is denied (caller must return).
 */
export function denyIfWrongStore(req: Request, res: Response, recordStoreId: number): boolean {
  if (isAdmin(req)) return false;
  if (req.user?.storeId !== recordStoreId) {
    res.status(403).json({ error: "Access denied" });
    return true;
  }
  return false;
}
