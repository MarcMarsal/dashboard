import { executeBacktest } from "../services/backtest.service.js";

export async function runBacktest(req, res) {
  try {
    const config = req.body;

    const summary = await executeBacktest(config);

    res.json({
      ok: true,
      summary
    });

  } catch (err) {
    console.error("Error al backtest:", err);
    res.status(500).json({ ok: false, error: "Error executant el backtest" });
  }
}
