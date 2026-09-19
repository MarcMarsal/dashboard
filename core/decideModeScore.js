// core/decidModeScore.js

export default function decideModeScore({ atr, slope, volume }) {
  let score = 0;

  if (atr > 0.001 && atr < 0.05) score += 4;
  if (Math.abs(slope) < atr * 0.35) score += 4;
  if (volume > 100000) score += 2;

  const mode = Math.abs(slope) < atr * 0.2 ? "USDT" : "CRYPTO";

  return { mode, score: Math.min(score, 10) };
}
