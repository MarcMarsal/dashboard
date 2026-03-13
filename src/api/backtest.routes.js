import { Router } from "express";
import { runBacktest } from "../controllers/backtest.controller.js";

const router = Router();

router.post("/run", runBacktest);

export default router;
