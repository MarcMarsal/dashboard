import express from "express";
import cors from "cors";

import backtestRoutes from "./api/backtest.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// 👉 Primer servir la carpeta public
app.use(express.static("public"));

// 👉 Després les rutes API
app.use("/backtest", backtestRoutes);

export default app;
