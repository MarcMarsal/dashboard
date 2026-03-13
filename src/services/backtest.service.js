import { db } from "../db.js";
import { timeframeToSeconds } from "../utils/timeframe.js";

export async function fetchStats() {
  const totals = await db.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result = 'NEUTRAL' THEN 1 ELSE 0 END) AS neutrals
    FROM backtest_results
  `);

  const row = totals.rows[0];

  const winrate =
    row.total > 0 ? (row.wins / row.total) * 100 : 0;

  const avg = await db.query(`
    SELECT 
      AVG(entry_price) AS avg_entry,
      AVG(tp_price) AS avg_tp,
      AVG(sl_price) AS avg_sl
    FROM backtest_results
  `);

  const byType = await db.query(`
    SELECT 
      tipo,
      COUNT(*) AS total,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result = 'NEUTRAL' THEN 1 ELSE 0 END) AS neutrals
    FROM backtest_results
    GROUP BY tipo
  `);

  return {
    total: Number(row.total),
    wins: Number(row.wins),
    losses: Number(row.losses),
    neutrals: Number(row.neutrals),
    winrate: Number(winrate.toFixed(2)),
    averages: {
      entry: Number(avg.rows[0].avg_entry || 0),
      tp: Number(avg.rows[0].avg_tp || 0),
      sl: Number(avg.rows[0].avg_sl || 0)
    },
    byType: byType.rows
  };
}


export async function executeBacktest(config) {
  const { symbol, timeframe, period, retracement, tp, slMode } = config;

  // 1. Buidar la taula
  await db.query("DELETE FROM backtest_results");

  // 2. Calcular timestamps del període
  const now = Date.now();
  const from =
    period === "1d"
      ? now - 86400000
      : period === "1w"
      ? now - 7 * 86400000
      : now - 30 * 86400000;

  // 3. Obtenir senyals
  const signals = await db.query(
    `SELECT * FROM signals
     WHERE symbol = $1
       AND timeframe = $2
       AND timestamp BETWEEN $3 AND $4
     ORDER BY timestamp ASC`,
    [symbol, timeframe, from, now]
  );

  let wins = 0;
  let losses = 0;
  let neutrals = 0;

  for (const signal of signals.rows) {
    const result = await processSignal(signal, config);
    if (!result) continue;

    await db.query(
      `INSERT INTO backtest_results
      (signal_timestamp, symbol, timeframe, tipo, retracement, tp_percent, sl_mode,
       entry_price, tp_price, sl_price, result, touched_tp, touched_sl)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        signal.timestamp,
        signal.symbol,
        signal.timeframe,
        signal.tipo,
        retracement,
        tp,
        slMode,
        result.entry,
        result.tp,
        result.sl,
        result.result,
        result.touchedTP,
        result.touchedSL
      ]
    );

    if (result.result === "WIN") wins++;
    else if (result.result === "LOSS") losses++;
    else neutrals++;
  }

  return { wins, losses, neutrals };
}

async function processSignal(signal, config) {
  const { retracement, tp, slMode } = config;

  // 1. Normalitzar tipus
  let tipo = signal.tipo;
  if (tipo.startsWith("MS")) tipo = "MS"; // LONG
  if (tipo.startsWith("ES")) tipo = "ES"; // SHORT

  // 2. Tercera vela
  const third = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2 AND timestamp = $3`,
    [signal.symbol, signal.timeframe, signal.timestamp]
  );
  if (!third.rows.length) return null;
  const thirdCandle = third.rows[0];

  // 3. Quarta vela tolerant
  const interval = timeframeToSeconds(signal.timeframe) * 1000;

  const fourth = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp > $3
       AND timestamp <= $3 + $4
     ORDER BY timestamp ASC
     LIMIT 1`,
    [signal.symbol, signal.timeframe, signal.timestamp, interval]
  );
  if (!fourth.rows.length) return null;
  const fourthCandle = fourth.rows[0];

  // 4. Cos i retracement
  const body = Math.abs(thirdCandle.close - thirdCandle.open);
  const retr = body * (retracement / 100);

  // 5. Entrada EXACTA segons la teva fórmula
  let entry;
  if (tipo === "MS") {
    // LONG → close - retracement
    entry = thirdCandle.close - retr;
  } else {
    // SHORT → close + retracement
    entry = thirdCandle.close + retr;
  }

  // 6. Comprovar si la quarta vela toca l’entrada
  const touchesEntry =
    fourthCandle.low <= entry && fourthCandle.high >= entry;

  if (!touchesEntry) return null;

  // 7. TP i SL
  const tpPrice =
    tipo === "MS"
      ? entry * (1 + tp / 100)
      : entry * (1 - tp / 100);

  const slPrice =
    slMode === "symmetric"
      ? tipo === "MS"
        ? entry * (1 - tp / 100)
        : entry * (1 + tp / 100)
      : tipo === "MS"
        ? thirdCandle.low
        : thirdCandle.high;

  // 8. Veles següents
  const nextCandles = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2 AND timestamp > $3
     ORDER BY timestamp ASC`,
    [signal.symbol, signal.timeframe, fourthCandle.timestamp]
  );

  for (const candle of nextCandles.rows) {
    const hitTP =
      tipo === "MS"
        ? candle.high >= tpPrice
        : candle.low <= tpPrice;

    const hitSL =
      tipo === "MS"
        ? candle.low <= slPrice
        : candle.high >= slPrice;

    if (hitTP && hitSL) {
      return {
        entry,
        tp: tpPrice,
        sl: slPrice,
        result: "NEUTRAL",
        touchedTP: true,
        touchedSL: true
      };
    }

    if (hitTP) {
      return {
        entry,
        tp: tpPrice,
        sl: slPrice,
        result: "WIN",
        touchedTP: true,
        touchedSL: false
      };
    }

    if (hitSL) {
      return {
        entry,
        tp: tpPrice,
        sl: slPrice,
        result: "LOSS",
        touchedTP: false,
        touchedSL: true
      };
    }
  }

  // 9. Si no toca res → neutral
  return {
    entry,
    tp: tpPrice,
    sl: slPrice,
    result: "NEUTRAL",
    touchedTP: false,
    touchedSL: false
  };
}
