// recalculate.js

import db from '../db/index.js';

// --- Càlcul ATR ---
function calcATR(candles) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// --- Càlcul slope ---
function calcSlope(candles) {
  const n = candles.length;
  const xs = [...Array(n).keys()];
  const ys = candles.map(c => c.close);
  const xMean = xs.reduce((a,b)=>a+b,0)/n;
  const yMean = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return num / den;
}

// --- Rang FI ---
function calcRangeFI(atr) {
  return atr * 20;
}

// --- Cel·les FI ---
function calcCells(rangeFI) {
  if (rangeFI < 0.5) return 10;
  if (rangeFI < 2) return 12;
  if (rangeFI < 5) return 15;
  return 18;
}

// --- Distància FI ---
function calcCellDistance(rangeFI, cells) {
  return rangeFI / cells;
}

// --- Mode + Score ---
function decideModeAndScore({ atr, slope, volume }) {
  let score = 0;

  // volatilitat útil
  if (atr > 0.001 && atr < 0.05) score += 4;

  // slope baix = rang
  if (Math.abs(slope) < atr * 0.35) score += 4;

  // volum decent
  if (volume > 100000) score += 2;

  const mode = Math.abs(slope) < atr * 0.2 ? 'USDT' : 'CRYPTO';

  return { mode, score: Math.min(score, 10) };
}

// --- Funció principal ---
export async function recalcGridRecommendations() {
  const symbols = await db.query(`
    SELECT DISTINCT symbol FROM candles
  `);

  for (const row of symbols.rows) {
    const symbol = row.symbol;

    const candles = await db.query(`
      SELECT * FROM candles
      WHERE symbol = $1 AND timeframe = '15m'
      ORDER BY ts DESC
      LIMIT 200
    `, [symbol]);

    if (candles.rows.length < 50) continue;

    const atr = calcATR(candles.rows);
    const slope = calcSlope(candles.rows);
    const rangeFI = calcRangeFI(atr);
    const cells = calcCells(rangeFI);
    const cellDistance = calcCellDistance(rangeFI, cells);

    const volume = candles.rows.reduce((a, c) => a + Number(c.volume), 0);

    const { mode, score } = decideModeAndScore({ atr, slope, volume });

    await db.query(`
      INSERT INTO grid_recommendations
      (symbol, mode, cells, cell_distance, range, atr, slope, volume, score, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
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
        updated_at = NOW()
    `, [
      symbol, mode, cells, cellDistance,
      rangeFI, atr, slope, volume, score
    ]);
  }
}
