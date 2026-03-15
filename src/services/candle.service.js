import db from "../db.js";
import { timeframeToSeconds } from "../utils/timeframe.js";

// Converteix timeframe (15m, 1h...) a ms
function tfToMs(tf) {
  return timeframeToSeconds(tf) * 1000;
}

async function getCandle(symbol, timeframe, ts) {
  const r = await db.query(
    `SELECT symbol, timeframe, open, high, low, close, volume,
            timestamp, timestamp_es, date_es
     FROM candles
     WHERE symbol = $1
       AND timeframe = $2
       AND timestamp = $3
     LIMIT 1`,
    [symbol, timeframe, ts]
  );

  return r.rows[0] || null;
}

// 1a vela: dues veles abans de la signal
export async function getFirstCandle(symbol, timeframe, ts3) {
  const r = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp < $3
     ORDER BY timestamp DESC
     LIMIT 2`,
    [symbol, timeframe, ts3]
  );
  return r.rows.length === 2 ? r.rows[1] : null;
}

// 2a vela: una vela abans de la signal
export async function getSecondCandle(symbol, timeframe, ts3) {
  const r = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp < $3
     ORDER BY timestamp DESC
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return r.rows[0] || null;
}

// 3a vela: la vela EXACTA de la signal
export async function getThirdCandle(symbol, timeframe, ts3) {
  const r = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp = $3`,
    [symbol, timeframe, ts3]
  );
  return r.rows[0] || null;
}

// 4a vela: la següent a la signal
export async function getFourthCandle(symbol, timeframe, ts3) {
  const r = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp > $3
     ORDER BY timestamp ASC
     LIMIT 1`,
    [symbol, timeframe, ts3]
  );
  return r.rows[0] || null;
}


// Comprovar si la 4a vela toca el preu d'entrada
export function checkEntry(fourth, entryPrice) {
  return fourth.low <= entryPrice && fourth.high >= entryPrice;
}

// Calcular TP i SL
export function computeTargets(tipo, entryPrice, tpPercent, slMode, third) {
  const tp = tipo === "MS"
    ? entryPrice * (1 + tpPercent / 100)
    : entryPrice * (1 - tpPercent / 100);

  let sl;

  if (slMode === "percent") {
    sl = tipo === "MS"
      ? entryPrice * (1 - tpPercent / 100)
      : entryPrice * (1 + tpPercent / 100);
  } else {
    // SL basat en la 3a vela
    sl = tipo === "MS" ? third.low : third.high;
  }

  return { tp, sl };
}

export async function getNextCandles(symbol, timeframe, ts4) {
  const r = await db.query(
    `SELECT * FROM candles
     WHERE symbol = $1 AND timeframe = $2
       AND timestamp > $3
     ORDER BY timestamp ASC`,
    [symbol, timeframe, ts4]
  );
  return r.rows;
}

export function checkTouches(tipo, candles, tp, sl) {
  if (candles.length === 0) {
    return { touchedTP: false, touchedSL: false, outcome: "NEUTRAL" };
  }

  for (const c of candles) {
    if (tipo === "MS") {
      if (c.high >= tp) return { touchedTP: true, touchedSL: false, outcome: "WIN" };
      if (c.low <= sl)  return { touchedTP: false, touchedSL: true, outcome: "LOSS" };
    } else {
      if (c.low <= tp)  return { touchedTP: true, touchedSL: false, outcome: "WIN" };
      if (c.high >= sl) return { touchedTP: false, touchedSL: true, outcome: "LOSS" };
    }
  }

  return { touchedTP: false, touchedSL: false, outcome: "NEUTRAL" };
}
