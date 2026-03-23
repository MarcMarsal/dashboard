import db from "../db.js";
import {
  getFirstCandle,
  getSecondCandle,
  getThirdCandle,
  getFourthCandle,
  getNextCandles,
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

    const hourSegment = getHourSegment(parseTimestampEs(s.timestamp_es));
    const dateObj = parseTimestampEs(s.timestamp_es);
    const heatmapSegment = getFranja(dateObj.getHours());

    // -------------------------------
    // NO ENTRY: falta alguna candle
    // -------------------------------
    if (!third || !second || !first || !fourth) {
      noEntries++;

      await db.query(`
  INSERT INTO backtest_results (
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
    hour_segment,
    heatmap_segment,
    is_entry,
    created_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,0,0,0,'NO_ENTRY',false,false,$9,$10,false,NOW()
  )
`, [
  s.timestamp,
  s.timestamp_es,
  symbol,
  timeframe,
  s.tipo,
  retracement,
  tpPercent,
  slMode,
  hourSegment,
  heatmapSegment
]);
      continue;
    }

    // -------------------------------
    // CÀLCUL ENTRADA
    // -------------------------------
    const isLong = s.tipo === "MS";
    const body = Math.abs(third.close - third.open);
    const retraceFraction = retracement / 100;
    const retraceAmount = body * retraceFraction;

    let entryPrice;
    if (isLong) {
      entryPrice = third.close - retraceAmount;
    } else {
      entryPrice = third.close + retraceAmount;
    }

    const hasEntry = checkEntry(fourth, entryPrice);

    // -------------------------------
    // NO ENTRY: no toca el nivell
    // -------------------------------
    if (!hasEntry) {
      noEntries++;

    await db.query(`
  INSERT INTO backtest_results (
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
    hour_segment,
    heatmap_segment,
    is_entry,
    created_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,NOW()
  )
`, [
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
  touchedSL,
  hourSegment,
  heatmapSegment
]);

      continue;
    }

    // -------------------------------
    // ENTRADA REAL
    // -------------------------------
    entries++;

    const { tp, sl } = computeTargets(
      s.tipo,
      entryPrice,
      tpPercent,
      slMode,
      third
    );

    const nextCandles = await getNextCandles(symbol, timeframe, fourth.timestamp);

    const { touchedTP, touchedSL, outcome } = checkTouches(
      s.tipo,
      nextCandles,
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
        hour_segment,
        is_entry,
        created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,NOW()
      )`,
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
        touchedSL,
        hourSegment
      ]
    );

    // Detall només per entrades reals
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

function getFranja(hour) {
  if (hour >= 9 && hour < 12) return "mati_eu";
  if (hour >= 12 && hour < 14) return "migdia_eu";
  if (hour >= 14 && hour < 16) return "pre_ws";
  if (hour >= 16 && hour < 18) return "tarda_eu";
  if (hour >= 18 && hour < 24) return "nit_eu";
  return "nit_matinada";
}

function getHourSegment(date) {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = diumenge, 6 = dissabte

  if (day === 6) return "dissabte";
  if (day === 0 && hour < 18) return "diumenge_mati";
  if (day === 0 && hour >= 18) return "diumenge_tarda";

  if (hour >= 9 && hour < 12) return "mati_eu";
  if (hour >= 12 && hour < 14) return "migdia_eu";
  if (hour >= 14 && hour < 16) return "pre_ws";
  if (hour >= 16 && hour < 18) return "tarda_eu";
  if (hour >= 18 && hour < 24) return "nit_eu";
  return "nit_matinada";
}

function parseTimestampEs(ts) {
  const [datePart, timePart] = ts.split(" ");
  const [day, month, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}`);
}


