// core/activeCryptos.js — Micrpulse
//Retirats per baix guanys: "TRX-USDT", "PAXG-USDT"

export const UNIVERSE = [
  "AAVE-USDT","ADA-USDT","APT-USDT","ARB-USDT","ASTER-USDT","ATOM-USDT",
  "AVAX-USDT","BCH-USDT","BNB-USDT","BTC-USDT","DOGE-USDT",
  "DOT-USDT","ENA-USDT","ETH-USDT","FET-USDT","GRAM-USDT",
  "HBAR-USDT","INJ-USDT","KAITO-USDT","LINK-USDT","LTC-USDT",
  "NEAR-USDT","ONDO-USDT","OP-USDT","PENGU-USDT",
  "PEPE-USDT","RENDER-USDT","RON-USDT","SEI-USDT","SOL-USDT",
  "SUI-USDT","TRUMP-USDT","VIRTUAL-USDT","XRP-USDT"
];

export const ACTIVE_CRYPTO_LIST = [
  "AAVE-USDT","ADA-USDT","APT-USDT","ARB-USDT","ASTER-USDT","ATOM-USDT",
  "AVAX-USDT","BCH-USDT","BNB-USDT","BTC-USDT","DOGE-USDT",
  "DOT-USDT","ENA-USDT","ETH-USDT","FET-USDT","GRAM-USDT",
  "HBAR-USDT","INJ-USDT","KAITO-USDT","LINK-USDT","LTC-USDT",
  "NEAR-USDT","ONDO-USDT","OP-USDT","PENGU-USDT",
  "PEPE-USDT","RENDER-USDT","RON-USDT","SEI-USDT","SOL-USDT",
  "SUI-USDT","TRUMP-USDT","VIRTUAL-USDT","XRP-USDT"
];

// -------------------------------------------------------------
// DECIMALS PER SIMBOL (FIAT)
// -------------------------------------------------------------
export const DECIMALS = {
  "AAVE-USDT": 2,
  "ADA-USDT": 4,
  "APT-USDT": 4,
  "ARB-USDT": 5,
  "ASTER-USDT": 4,
  "ATOM-USDT": 3,
  "AVAX-USDT": 3,
  "BCH-USDT": 2,
  "BNB-USDT": 2,
  "BTC-USDT": 1,
  "DOGE-USDT": 5,
  "DOT-USDT": 4,
  "ENA-USDT": 5,
  "ETH-USDT": 2,
  "FET-USDT": 4,
  "GRAM-USDT": 4,
  "HBAR-USDT": 5,
  "INJ-USDT": 3,
  "KAITO-USDT": 4,
  "LINK-USDT": 3,
  "LTC-USDT": 2,
  "NEAR-USDT": 3,
  "ONDO-USDT":4,
  "OP-USDT": 5,
  "PAXG-USDT": 2,
  "PENGU-USDT": 6,
  "PEPE-USDT": 7,
  "RENDER-USDT": 3,
  "RON-USDT": 5,
  "SEI-USDT": 5,
  "SOL-USDT": 2,
  "SUI-USDT": 4,
  
  
  "TRUMP-USDT": 3,
  "TRX-USDT": 5,
  "VIRTUAL-USDT": 4,
  "XRP-USDT": 4 
};

// -------------------------------------------------------------
// FORMATAR NÚMEROS SEGONS EL SIMBOL
// -------------------------------------------------------------
export function fmt(n, symbol) {
  const d = DECIMALS[symbol] ?? 4;
  return Number(n).toFixed(d);
}
