import express from "express";
import cors from "cors";

import backtestRoutes from "./api/backtest.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/backtest", backtestRoutes);
app.use(express.static("public"));


export default app;
