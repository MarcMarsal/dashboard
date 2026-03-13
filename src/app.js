import express from "express";
import cors from "cors";

import backtestRoutes from "./api/backtest.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/backtest", backtestRoutes);

export default app;
