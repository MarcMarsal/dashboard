export function timeframeToSeconds(tf) {
  switch (tf) {
    case "15m": return 900;
    case "30m": return 1800;
    case "1h": return 3600;
    case "4h": return 14400;
    default:
      throw new Error("Timeframe no suportat: " + tf);
  }
}
