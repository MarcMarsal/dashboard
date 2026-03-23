import { executeBacktest } from "../services/backtest.service.js";
import { fetchStats } from "../services/backtest.service.js";
import db from "../db.js";


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

export async function fetchSegmentReport(req, res) {
  const r = await db.query(`
    SELECT hour_segment,
           COUNT(*) AS total_signals,
           SUM(CASE WHEN is_entry THEN 1 ELSE 0 END) AS entries,
           SUM(CASE WHEN NOT is_entry THEN 1 ELSE 0 END) AS no_entries,
           SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
           SUM(CASE WHEN result = 'NEUTRAL' THEN 1 ELSE 0 END) AS neutrals
    FROM backtest_results
    GROUP BY hour_segment
    ORDER BY hour_segment;
  `);

  res.json(r.rows);
}

export async function fetchBacktestResults(req, res) {
  const { symbol, timeframe } = req.query;

  try {
    const r = await db.query(
      `
      SELECT
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
        touched_sl,
        hour_segment,
        heatmap_segment,
        is_entry
      FROM backtest_results
      WHERE symbol = $1
        AND timeframe = $2
        AND heatmap_segment IS NOT NULL
        AND COALESCE(
              to_timestamp(timestamp_es, 'DD/MM/YYYY HH24:MI:SS'),
              to_timestamp(timestamp_es, 'DD/MM/YYYY HH24:MI')
            )
            BETWEEN NOW() - INTERVAL '7 days' AND NOW()
      ORDER BY COALESCE(
              to_timestamp(timestamp_es, 'DD/MM/YYYY HH24:MI:SS'),
              to_timestamp(timestamp_es, 'DD/MM/YYYY HH24:MI')
            ) ASC
      `,
      [symbol, timeframe]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("Error a fetchBacktestResults:", err);
    res.status(500).json({ error: "Error carregant resultats" });
  }
}
