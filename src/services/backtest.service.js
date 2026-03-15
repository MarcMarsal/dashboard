import db from "../db.js";
import {
  getFirstCandle,
  getSecondCandle,
  getThirdCandle,
  getFourthCandle,
  checkEntry,
  computeTargets,
  checkTouches
} from "./candle.service.js";

// BACKTEST PRINCIPAL
export async function executeBacktest({
  symbol,
  timeframe,
  start,
  end,
  tpPercent,
  slMode,
  retracement
}) {
  await db.query("DELETE FROM backtest_results");

  const signals = await db.query(
    `SELECT symbol, timeframe, tipo, entry, timestamp, timestamp_es
     FROM signals
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp BETWEEN $3 AND $4
     ORDER BY timestamp ASC`,
    [symbol, timeframe, start, end]
  );

  console.log("SIGNALS DEBUG:", {
    symbol,
    timeframe,
    start,
    end,
    count: signals.rows.length
  });

  let total = 0;
  let entries = 0;
  let noEntries = 0;
  let wins = 0;
  let losses = 0;
  let neutrals = 0;
  const details = [];

  for (const s of signals.rows) {
    total++;

    const ts3 = s.timestamp;

    const third = await getThirdCandle(symbol, timeframe, ts3);
    const second = await getSecondCandle(symbol, timeframe, ts3);
    const first = await getFirstCandle(symbol, timeframe, ts3);
    const fourth = await getFourthCandle(symbol, timeframe, ts3);

    console.log("DEBUG FOURTH CANDLE:", fourth);

    if (!third || !second || !first || !fourth) {
      noEntries++;
      continue;
    }

    const isLong = s.tipo === "MS";

  

// --- ENTRADA: retrocés sobre el cos de la 3a vela ---
const body = Math.abs(third.close - third.open);
const retraceFraction = retracement / 100;
const retraceAmount = body * retraceFraction;

let entryPrice;
if (isLong) {
  // MS: entrada = close 3a - % cos
  entryPrice = third.close - retraceAmount;
} else {
  // ES: entrada = close 3a + % cos
  entryPrice = third.close + retraceAmount;
}


    const hasEntry = checkEntry(fourth, entryPrice);
    if (!hasEntry) {
      noEntries++;
      continue;
    }

    entries++;

    const { tp, sl } = computeTargets(
      s.tipo,
      entryPrice,
      tpPercent,
      slMode,
      third
    );

    const { touchedTP, touchedSL, outcome } = checkTouches(
      s.tipo,
      fourth,
      tp,
      sl
    );

    if (outcome === "WIN") wins++;
    else if (outcome === "LOSS") losses++;
    else neutrals++;

    await db.query(
      `INSERT INTO backtest_results (
        signal_timestamp,
        timestamp_es,
        symbol,
        timeframe,
        tipo,
        retracement,
        tp_percent,
        sl_mode,
        entry_price,
        tp_price,
        sl_price,
        result,
        touched_tp,
        touched_sl,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
      [
        s.timestamp,
        s.timestamp_es,
        symbol,
        timeframe,
        s.tipo,
        retracement,
        tpPercent,
        slMode,
        entryPrice,
        tp,
        sl,
        outcome,
        touchedTP,
        touchedSL
      ]
    );

    details.push({
      timestamp_es: s.timestamp_es,
      ts: s.timestamp,
      entry_price: entryPrice,
      first,
      second,
      third,
      fourth,
      touch_entry: hasEntry,
      tp_price: tp,
      sl_price: sl,
      touched_tp: touchedTP,
      touched_sl: touchedSL,
      outcome
    });
  }

  return {
    totalSignals: total,
    entries,
    noEntries,
    wins,
    losses,
    neutrals,
    winRate: entries > 0 ? (wins / entries) * 100 : 0,
    entryRate: total > 0 ? (entries / total) * 100 : 0,
    details
  };
}

export async function fetchStats() {
  const r = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result = 'NEUTRAL' THEN 1 ELSE 0 END) AS neutrals
    FROM backtest_results
  `);

  const s = r.rows[0];

  const winrate =
    s.wins > 0 ? ((s.wins / (s.wins + s.losses + s.neutrals)) * 100).toFixed(2) : 0;

  return {
    total: Number(s.total),
    wins: Number(s.wins),
    losses: Number(s.losses),
    neutrals: Number(s.neutrals),
    winrate
  };
}
