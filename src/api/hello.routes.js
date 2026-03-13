import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Dashboard API OK" });
});

export default router;
