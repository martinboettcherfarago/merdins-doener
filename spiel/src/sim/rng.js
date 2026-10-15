// Reproduzierbarer Zufall (mulberry32) mit speicherbarem Zustand.
// rng() → Zahl in [0, 1); rng.state() liefert den Zustand, rng.setState(s) setzt ihn (für Spielstände).
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => a;
  rng.setState = (s) => { if (Number.isFinite(s)) a = s >>> 0; };
  return rng;
}
