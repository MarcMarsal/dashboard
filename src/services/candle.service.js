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

export async function getFirstCandle(symbol, timeframe, ts3) {
  const ms = tfToMs(timeframe);
  return getCandle(symbol, timeframe, ts3 - 3 * ms);
}

export async function getSecondCandle(symbol, timeframe, ts3) {
  const ms = tfToMs(timeframe);
  return getCandle(symbol, timeframe, ts3 - 2 * ms);
}

export async function getThirdCandle(symbol, timeframe, ts3) {
  const ms = tfToMs(timeframe);
  return getCandle(symbol, timeframe, ts3 - 1 * ms);
}

export async function getFourthCandle(symbol, timeframe, ts3) {
  return getCandle(symbol, timeframe, ts3);
}

// Comprovar si la 4a vela toca el preu d'entrada
export function checkEntry(fourth, entryPrice) {
  return fourth.l <= entryPrice && fourth.h >= entryPrice;
}

// Calcular TP i SL
export function computeTargets(tipo, entryPrice, tpPercent, slMode, third) {
  // TP basat en percentatge (35% en el teu cas)
  const tp = tipo === "MS"
    ? entryPrice * (1 + tpPercent / 100)
    : entryPrice * (1 - tpPercent / 100);

  let sl;

  if (slMode === "percent") {
    // SL simètric al TP
    sl = tipo === "MS"
      ? entryPrice * (1 - tpPercent / 100)
      : entryPrice * (1 + tpPercent / 100);
  } else {
    // SL basat en la 3a vela (el que tu fas realment)
    sl = tipo === "MS" ? third.low : third.high;
  }

  return { tp, sl };
}

// Comprovar si toca TP o SL
export function checkTouches(tipo, fourth, tp, sl) {
  const isLong = tipo === "MS";

  const touchedTP = isLong
    ? fourth.high >= tp
    : fourth.low <= tp;

  const touchedSL = isLong
    ? fourth.low <= sl
    : fourth.high >= sl;

  let outcome = "NEUTRAL";
  if (touchedTP) outcome = "WIN";
  else if (touchedSL) outcome = "LOSS";

  return { touchedTP, touchedSL, outcome };
}
