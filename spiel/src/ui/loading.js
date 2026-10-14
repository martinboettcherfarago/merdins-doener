// Ladebildschirm: liegt als statisches HTML in index.html (#loader) und ist ab dem ersten Bild sichtbar.
// Beim Start übernimmt bootSequence(): Materialien/Texturen werden in Häppchen erzeugt (echter Fortschritt),
// danach die Beispielstadt des Menüs. Beim Gründen/Laden einer Stadt zeigt showLoader() den Bildschirm erneut.
import { MATERIAL_NAMES, getMaterial } from '../render/matlib.js';
import { getAtlasMaterial } from '../render/atlas.js';
import * as protos from '../render/protos.js';

const TIPS = [
  'Strom und Wasser fließen über Straßen.',
  'Rechte Maustaste verschiebt, Mausrad zoomt.',
  'P: Fotomodus.',
  'Die Balken W G I B zeigen, was gefragt ist.',
  'Industrie mit Abstand zum Wohnen.',
  'Jede U-Bahn-Ankunft spielt einen Ton.',
  'F: Baukatalog durchsuchen.',
  'Parks heben den Bodenwert.',
  '? zeigt alle Tasten.',
  'Stadt-Check oben rechts: was gerade hakt.',
  'Ab 150 Einwohnern: jede Woche eine Karte.',
];

// Übernahme kennzeichnen (das Notfall-Skript in index.html blendet sonst nach einiger Zeit aus)
if (typeof window !== 'undefined') window.__stadtpulsLoader = true;
// Für Prüfskripte: window.__stadtpulsLoaderApi.show('Titel') usw.

let tipTimer = 0, tipIdx = Math.floor(Math.random() * TIPS.length), hideTimer = 0;
const $ = (id) => document.getElementById(id);

export function loaderEl() {
  let el = $('loader');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'loader';
  el.className = 'loader';
  el.innerHTML = `<div class="ld-sky"><i></i><i></i><i></i></div><div class="ld-card"><div class="ld-brand"><svg width="54" height="54" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path class="ld-pulse" d="M5 22h7l3-9 5 16 4-11 2 4h9" stroke="#f6f2ea" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="35" cy="22" r="3" fill="#e8543f"/></svg><b>Stadtpuls</b></div><div class="ld-title" id="ld-title"></div><div class="ld-line"><span class="ld-st"></span><span class="ld-st"></span><span class="ld-st"></span><span class="ld-st"></span><span class="ld-st"></span></div><div class="ld-bar"><i id="ld-fill"></i><span class="ld-shine"></span></div><div class="ld-step" id="ld-step"></div><div class="ld-tip" id="ld-tip"></div></div>`;
  document.getElementById('app').appendChild(el);
  return el;
}
export const loaderVisible = () => { const el = $('loader'); return !!el && !el.hidden && !el.classList.contains('out'); };

function rotateTips() {
  clearInterval(tipTimer);
  const t = $('ld-tip');
  if (!t) return;
  const set = () => { tipIdx = (tipIdx + 1) % TIPS.length; t.classList.remove('in'); void t.offsetWidth; t.textContent = 'Tipp: ' + TIPS[tipIdx]; t.classList.add('in'); };
  set();
  tipTimer = setInterval(set, 4200);
}

export function showLoader(title, step = '') {
  const el = loaderEl();
  clearTimeout(hideTimer);
  el.hidden = false;
  el.classList.remove('out', 'boot', 'pre');
  const tt = $('ld-title'); if (tt) tt.textContent = title || '';
  setLoader(0.04, step);
  rotateTips();
}

export function setLoader(p, step) {
  const f = $('ld-fill');
  if (f) { f.style.animation = 'none'; f.style.transform = `scaleX(${Math.max(0.02, Math.min(1, p))})`; }
  // Haltestellen der Ladelinie leuchten nach Fortschritt auf, die nächste pulsiert
  const sts = document.querySelectorAll('#loader .ld-st');
  const n = sts.length;
  sts.forEach((st, k) => { const at = n > 1 ? k / (n - 1) : 0; st.classList.toggle('on', p >= at - 0.001); st.classList.toggle('next', p < at && (k === 0 || p >= (k - 1) / (n - 1))); });
  if (step !== undefined) { const s = $('ld-step'); if (s) s.textContent = step; }
}

export function hideLoader(instant = false) {
  const el = $('loader');
  if (!el || el.hidden) return;
  setLoader(1);
  clearInterval(tipTimer);
  clearTimeout(hideTimer);
  if (instant || document.documentElement.classList.contains('lowfps')) { el.hidden = true; el.classList.remove('out'); return; }
  el.classList.add('out');
  hideTimer = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 520);
}

// Wartet, bis der Browser ein Bild gezeichnet hat (damit Fortschritt sichtbar wird)
export const painted = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
export const frames = (n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });

// Erster Start: Texturen vorbereiten, dann die Menü-Stadt aufbauen
export async function bootSequence(app) {
  const el = loaderEl();
  el.classList.remove('boot');
  const tt = $('ld-title'); if (tt) tt.textContent = 'Die Stadt erwacht';
  rotateTips();
  setLoader(0.06, 'Programm geladen');
  await painted();
  const names = MATERIAL_NAMES;
  let k = 0;
  while (k < names.length) {
    const t0 = performance.now();
    while (k < names.length && performance.now() - t0 < 40) { try { getMaterial(names[k]); } catch (e) { console.warn(e); } k++; }
    setLoader(0.06 + 0.5 * (k / names.length), `Materialien und Texturen · ${k} von ${names.length}`);
    await painted();
  }
  try { getAtlasMaterial(); } catch (e) { console.warn(e); }
  // Optional (G9): protos.prewarm(onProgress) baut häufige Modelle vorab in einen Zwischenspeicher
  const hook = 'prewarm';
  const pre = protos[hook];
  if (typeof pre === 'function') {
    try {
      await pre((p, text) => { setLoader(0.58 + 0.06 * Math.max(0, Math.min(1, p)), text || 'Gebäudemodelle'); return painted(); });
    } catch (e) { console.warn(e); }
  }
  setLoader(0.64, 'Baukasten bereit · Beispielstadt wird errichtet');
  await painted();
  app.mode = 'menu';
  try { app.menuPreview(null); } catch (e) { console.error(e); }
  setLoader(0.86, 'Licht, Schatten und Leben');
  await frames(3);
  hideLoader();
}

if (typeof window !== 'undefined') window.__stadtpulsLoaderApi = { show: (...a) => showLoader(...a), set: (...a) => setLoader(...a), hide: (...a) => hideLoader(...a) };

// Die Seite hat keinen Loader nötig (Galerie, kein WebGL): sofort entfernen
(function earlyExit() {
  if (typeof location === 'undefined') return;
  let ok = true;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    ok = !!gl;
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { ok = false; }
  if (/[?&]gallery=/.test(location.search) || !ok) { const el = $('loader'); if (el) el.remove(); }
})();
