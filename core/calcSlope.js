// core/calcSlope.js

export default function calcSlope(candles) {
  const n = candles.length;
  const xs = [...Array(n).keys()];
  const ys = candles.map(c => c.close);
  const xMean = xs.reduce((a,b)=>a+b,0)/n;
  const yMean = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return num / den;
}
