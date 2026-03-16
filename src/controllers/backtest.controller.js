import { executeBacktest } from "../services/backtest.service.js";
import { fetchStats } from "../services/backtest.service.js";

export async function getStats(req, res) {
  try {
    const stats = await fetchStats();
    res.json({ ok: true, stats });
  } catch (err) {
    console.error("Error obtenint stats:", err);
    res.status(500).json({ ok: false, error: "Error obtenint estadístiques" });
  }
}



export async function runBacktest(req, res) {
  try {
    const config = req.body;

    const summary = await executeBacktest(config);

    res.json({
      ok: true,
      summary
    });

  } catch (err) {
    console.error("Error al backtest:", err.stack || err);
    res.status(500).json({ ok: false, error: "Error executant el backtest" });
  }
}

export async function fetchBacktestResults(req, res) {
  const r = await db.query(
    `SELECT
        signal_timestamp,
        timestamp_es,
        symbol,
        timeframe,
        tipo,
        entry_price,
        tp_price,
        sl_price,
        result,
        touched_tp,
        touched_sl
     FROM backtest_results
     ORDER BY signal_timestamp ASC`
  );

  res.json(r.rows);
}

