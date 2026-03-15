

export function timeframeToSeconds(tf) {
  const n = parseInt(tf);

  if (tf.endsWith("m")) return n * 60;
  if (tf.endsWith("h")) return n * 60 * 60;
  if (tf.endsWith("d")) return n * 24 * 60 * 60;

  throw new Error("Timeframe no reconegut: " + tf);
}
