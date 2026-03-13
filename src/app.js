import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Aquí afegirem les rutes del dashboard
// Exemple:
// import backtestRoutes from "./api/backtest.routes.js";
// app.use("/backtest", backtestRoutes);

export default app;
