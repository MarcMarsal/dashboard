// core/calcCells.js

export default function calcCells(rangeFI) {
  if (rangeFI < 0.5) return 10;
  if (rangeFI < 2) return 12;
  if (rangeFI < 5) return 15;
  return 18;
}
