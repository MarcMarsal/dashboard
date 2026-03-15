import { db } from "../db.js";

// 3a vela = la de l'alerta
async function getThirdCandle(symbol, timeframe, ts3) {
  const q = await db.query(
    `SELECT open, high, low, close, timestamp_es
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_es = $3
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return q.rows[0] || null;
}

// 2a vela = la immediatament anterior
async function getSecondCandle(symbol, timeframe, ts3) {
  const q = await db.query(
    `SELECT open, high, low, close, timestamp_es
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_es < $3
     ORDER BY timestamp_es DESC
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return q.rows[0] || null;
}

// 1a vela = la d'abans de la 2a
async function getFirstCandle(symbol, timeframe, ts3) {
  const q = await db.query(
    `SELECT open, high, low, close, timestamp_es
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_es < $3
     ORDER BY timestamp_es DESC
     OFFSET 1
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return q.rows[0] || null;
}

// 4a vela = la següent
async function getFourthCandle(symbol, timeframe, ts3) {
  const q = await db.query(
    `SELECT open, high, low, close, timestamp_es
     FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_es > $3
     ORDER BY timestamp_es ASC
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return q.rows[0] || null;
}

// TP / SL
function computeTargets(tipo, entryPrice, tpPercent, slMode, second) {
  const isLong = tipo === "MS";

  const tp = isLong
    ? entryPrice * (1 + tpPercent / 100)
    : entryPrice * (1 - tpPercent / 100);

  let sl;
  if (slMode === "simetric") {
    sl = isLong
      ? entryPrice * (1 - tpPercent / 100)
      : entryPrice * (1 + tpPercent / 100);
  } else {
    sl = isLong ? second.low : second.high;
  }

  return { tp, sl };
}

// Entrada
function checkEntry(fourth, entryPrice) {
  return fourth.low <= entryPrice && entryPrice <= fourth.high;
}

// TP/SL tocats
function checkTouches(tipo, fourth, tp, sl) {
  const prices = [fourth.open, fourth.high, fourth.low, fourth.close];
  const isLong = tipo === "MS";

  let touchedTP = false;
  let touchedSL = false;

  if (isLong) {
    touchedTP = prices.some((p) => p >= tp);
    touchedSL = prices.some((p) => p <= sl);
  } else {
    touchedTP = prices.some((p) => p <= tp);
    touchedSL = prices.some((p) => p >= sl);
  }

  let outcome = "NEUTRAL";
  if (touchedTP && !touchedSL) outcome = "WIN";
  else if (!touchedTP && touchedSL) outcome = "LOSS";
  else if (touchedTP && touchedSL) outcome = "NEUTRAL";

  return { touchedTP, touchedSL, outcome };
}

// BACKTEST
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
    `SELECT symbol, timeframe, tipo, entry, timestamp_es
     FROM signals
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp_es BETWEEN $3 AND $4
     ORDER BY timestamp_es ASC`,
    [symbol, timeframe, start, end]
  );

  let total = 0;
  let entries = 0;
  let noEntries = 0;
  let wins = 0;
  let losses = 0;
  let neutrals = 0;
  const details = [];

  for (const s of signals.rows) {
    total++;

    const ts3 = s.timestamp_es; // la 3a vela real

    const third = await getThirdCandle(symbol, timeframe, ts3);
    const second = await getSecondCandle(symbol, timeframe, ts3);
    const first = await getFirstCandle(symbol, timeframe, ts3);
    const fourth = await getFourthCandle(symbol, timeframe, ts3);

    if (!third || !second || !first || !fourth) {
      noEntries++;
      continue;
    }

    const isLong = s.tipo === "MS";

    const entryOriginal = Number(s.entry);
    const entryPrice = isLong
      ? entryOriginal * (1 - retracement / 100)
      : entryOriginal * (1 + retracement / 100);

    const hasEntry = checkEntry(fourth, entryPrice);
    if (!hasEntry) {
      noEntries++;
      continue;
    }

    entries++;

    const { tp, sl } = computeTargets(s.tipo, entryPrice, tpPercent, slMode, second);
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
        s.timestamp_es,
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
      entry_original: entryOriginal,
      entry_retracement: entryPrice,
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
  const q = await db.query(`SELECT COUNT(*) FROM signals`);
  return { totalSignals: Number(q.rows[0].count) };
}
