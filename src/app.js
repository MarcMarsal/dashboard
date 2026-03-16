import express from "express";
import cors from "cors";
import backtestRoutes from "./api/backtest.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Servir carpeta public
app.use(express.static("public"));

// Muntar totes les rutes del backtest
app.use("/backtest", backtestRoutes);

export default app;
