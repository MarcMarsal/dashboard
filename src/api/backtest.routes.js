import { Router } from "express";
import { runBacktest } from "../controllers/backtest.controller.js";
import { getStats } from "../controllers/backtest.controller.js";
import { fetchBacktestResults } from "../controllers/backtest.controller.js";

const router = Router();

router.post("/run", runBacktest);

router.get("/stats", getStats);

router.get("/backtest/results", fetchBacktestResults);


export default router;
