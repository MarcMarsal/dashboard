
import * as db from "../db.js";

// ----------------------
// OBTENIR 4a VELA
// ----------------------
async function getFourthCandle(symbol, timeframe, signalTimestamp) {
  const q = await db.query(
    `SELECT open, high, low, close, timestamp_open, timestamp_close
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_open > $3
     ORDER BY timestamp_open ASC
     LIMIT 1`,
    [symbol, timeframe, signalTimestamp]
  );

  return q.rows[0] || null;
}

// ----------------------
// OBTENIR 3a VELA
// ----------------------
async function getThirdCandle(symbol, timeframe, signalTimestamp) {
  const q = await db.query(
    `SELECT open, high, low, close
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_close = $3
     LIMIT 1`,
    [symbol, timeframe, signalTimestamp]
  );

  return q.rows[0] || null;
}

// ----------------------
// CALCULAR TP I SL
// ----------------------
function computeTargets(tipo, entry, tpPercent, slMode, third) {
  const tp =
    tipo === "MS"
      ? entry * (1 + tpPercent / 100)
      : entry * (1 - tpPercent / 100);

  let sl;

  if (slMode === "simetric") {
    sl =
      tipo === "MS"
        ? entry * (1 - tpPercent / 100)
        : entry * (1 + tpPercent / 100);
  } else {
    sl = tipo === "MS" ? third.low : third.high;
  }

  return { tp, sl };
}

// ----------------------
// COMPROVAR ENTRADA
// ----------------------
function checkEntry(fourth, entry) {
  return fourth.low <= entry && entry <= fourth.high;
}

// ----------------------
// COMPROVAR RESULTAT
// ----------------------
function checkOutcome(tipo, fourth, tp, sl) {
  const prices = [fourth.open, fourth.high, fourth.low, fourth.close];

  if (tipo === "MS") {
    if (prices.some((p) => p >= tp)) return "WIN";
    if (prices.some((p) => p <= sl)) return "LOSS";
  } else {
    if (prices.some((p) => p <= tp)) return "WIN";
    if (prices.some((p) => p >= sl)) return "LOSS";
  }

  return "NEUTRAL";
}

// ----------------------
// BACKTEST COMPLET
// ----------------------
export async function executeBacktest({
  symbol,
  timeframe,
  start,
  end,
  tpPercent,
  slMode
}) {
  const signals = await db.query(
    `SELECT symbol, timeframe, tipo, entry, timestamp
     FROM signals
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp BETWEEN $3 AND $4
     ORDER BY timestamp ASC`,
    [symbol, timeframe, start, end]
  );

  let total = 0;
  let entries = 0;
  let noEntries = 0;
  let wins = 0;
  let losses = 0;
  let neutrals = 0;

  for (const s of signals.rows) {
    total++;

    const fourth = await getFourthCandle(symbol, timeframe, s.timestamp);
    if (!fourth) {
      noEntries++;
      continue;
    }

    const third = await getThirdCandle(symbol, timeframe, s.timestamp);

    const hasEntry = checkEntry(fourth, s.entry);
    if (!hasEntry) {
      noEntries++;
      continue;
    }

    entries++;

    const { tp, sl } = computeTargets(
      s.tipo,
      s.entry,
      tpPercent,
      slMode,
      third
    );

    const outcome = checkOutcome(s.tipo, fourth, tp, sl);

    if (outcome === "WIN") wins++;
    else if (outcome === "LOSS") losses++;
    else neutrals++;
  }

  return {
    totalSignals: total,
    entries,
    noEntries,
    wins,
    losses,
    neutrals,
    winRate: entries > 0 ? (wins / entries) * 100 : 0,
    entryRate: total > 0 ? (entries / total) * 100 : 0
  };
}

// ----------------------
// STATS GLOBALS
// ----------------------
export async function fetchStats() {
  const q = await db.query(`SELECT COUNT(*) FROM signals`);
  return { totalSignals: Number(q.rows[0].count) };
}

