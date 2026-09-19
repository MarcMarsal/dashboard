// core/recalc.js
import { client } from "../db/client.js";
import calcATR from "./calcATR.js";
import calcSlope from "./calcSlope.js";
import calcRangeFI from "./calcRange.js";
import calcCells from "./calcCells.js";
import calcCellDistance from "./calcDistance.js";
import decideModeScore from "./decideModeScore.js";
import { UNIVERSE } from "./activeCryptos.js";   // <-- la teva llista FI

export default async function recalcGridRecommendations() {

  for (const symbol of UNIVERSE) {

    const candles = await client.query(`
      SELECT *
      FROM candles
      WHERE symbol = $1 AND timeframe = '15m'
      ORDER BY timestamp_es DESC
      LIMIT 200
    `, [symbol]);

    if (candles.rows.length < 50) continue;

    const atr = calcATR(candles.rows);
    const slope = calcSlope(candles.rows);
    const rangeFI = calcRangeFI(atr);
    const cells = calcCells(rangeFI);
    const cellDistance = calcCellDistance(rangeFI, cells);
    const volume = candles.rows.reduce((a, c) => a + Number(c.volume), 0);

    const { mode, score } = decideModeScore({ atr, slope, volume });

    await client.query(`
      INSERT INTO grid_recommendations
      (symbol, mode, cells, cell_distance, range, atr, slope, volume, score, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() AT TIME ZONE 'Europe/Madrid')
      ON CONFLICT (symbol)
      DO UPDATE SET
        mode = EXCLUDED.mode,
        cells = EXCLUDED.cells,
        cell_distance = EXCLUDED.cell_distance,
        range = EXCLUDED.range,
        atr = EXCLUDED.atr,
        slope = EXCLUDED.slope,
        volume = EXCLUDED.volume,
        score = EXCLUDED.score,
        updated_at = NOW() AT TIME ZONE 'Europe/Madrid'
    `, [
      symbol, mode, cells, cellDistance,
      rangeFI, atr, slope, volume, score
    ]);
  }

  console.log("Grid recommendations updated");
}
