import { Router } from "express";

const router = Router();

router.post("/admin/auth", (req, res) => {
  const { pin } = req.body as { pin?: string };
  const adminPin = process.env.ADMIN_PIN ?? "1234";
  res.json({ success: pin === adminPin });
});

export default router;
