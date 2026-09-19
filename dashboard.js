// dashboard.js
import cron from "node-cron";
import { client, initDB } from "./db/client.js";
import recalcGridRecommendations from "./core/recalc.js";

async function mainLoop() {
  try {
    await recalcGridRecommendations();
  } catch (err) {
    console.log("Error recalculant recomanacions FI:", err.message);
  }
}

async function startDashboard() {
  await initDB();
  console.log("Dashboard FI connectat a PostgreSQL");

  // Primer càlcul en arrencar
  await mainLoop();

  // Cada 15 minuts
  cron.schedule("*/15 * * * *", mainLoop);

  console.log("Dashboard FI en marxa (recomanacions grid cada 15m)");
}

startDashboard();
