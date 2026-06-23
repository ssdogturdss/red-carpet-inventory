import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const USER_TOKEN_HEADER = "x-user-token";

/**
 * Express middleware that requires a valid employee session token.
 * The token must be passed in the `x-user-token` header and must match
 * an active user's session token in the database.
 * Returns 401 if missing or invalid.
 */
export async function requireEmployeeAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  next();
}
