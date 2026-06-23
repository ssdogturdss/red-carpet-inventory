import { Router } from "express";
import { verifyAdminPin } from "../lib/adminAuth";

const router = Router();

router.post("/admin/auth", (req, res) => {
  const { pin } = req.body as { pin?: string };
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  const check = verifyAdminPin(pin, ip);

  if (check.result === "ok") {
    res.json({ success: true });
    return;
  }

  if (check.result === "unconfigured") {
    res.status(503).json({ success: false, error: "Admin access is not configured" });
    return;
  }

  if (check.result === "rate_limited") {
    const retryAfterSec = Math.ceil(check.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ success: false, error: "Too many attempts. Try again later.", retryAfterSec });
    return;
  }

  res.status(401).json({ success: false, error: "Invalid PIN" });
});

export default router;
