// Diagramme für Panels. Zwei Arten:
//  - Canvas (nach dem Rendern zeichnen, z. B. in afterRender): drawLineChart, drawBarChart, drawPyramid
//  - HTML/SVG-Text (direkt in render() einsetzbar, ohne afterRender): svgSpark, svgDonut, barsHTML, meterHTML, stackHTML
// Farben als CSS-Farbe (#rrggbb). Alle Funktionen sind für Panels anderer Module freigegeben.

const INK = '#7a8294';
const FONT = '600 11px "Stadtpuls Rund", Outfit, sans-serif';
const nf = (v) => Math.round(v).toLocaleString('de-DE');

function prep(canvas, hDefault = 120) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || hDefault;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// Liniendiagramm mit Fläche. opts: color, zero, fmt, startLabel, endLabel, series: [{ values, color, dash }]
export function drawLineChart(canvas, values, opts = {}) {
  const { ctx, w, h } = prep(canvas);
  const color = opts.color || '#2f8fe0';
  const padL = 44, padR = 8, padT = 10, padB = 18;
  const extra = opts.series || [];
  if (!values.length) {
    ctx.fillStyle = INK; ctx.font = '12px "Stadtpuls Text", Figtree, sans-serif';
    ctx.fillText(opts.empty || 'Noch keine Daten – der Verlauf erscheint nach dem ersten Spieltag.', 8, h / 2);
    return;
  }
  let min = Math.min(...values), max = Math.max(...values);
  for (const s of extra) for (const v of s.values) { min = Math.min(min, v); max = Math.max(max, v); }
  if (opts.zero) min = Math.min(0, min);
  if (opts.min !== undefined) min = Math.min(min, opts.min);
  if (opts.max !== undefined) max = Math.max(max, opts.max);
  if (max - min < 1e-6) { max += 1; min -= opts.zero ? 0 : 1; }
  const span = max - min;
  const n = values.length;
  const X = (i, len = n) => padL + (len === 1 ? (w - padL - padR) : (i / (len - 1)) * (w - padL - padR));
  const Y = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);
  ctx.strokeStyle = 'rgba(29,35,48,0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = INK;
  ctx.font = FONT;
  ctx.textAlign = 'right';
  for (let k = 0; k <= 3; k++) {
    const v = min + (span * k) / 3;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(opts.fmt ? opts.fmt(v) : nf(v), padL - 6, y + 4);
  }
  if (opts.zero && min < 0) {
    ctx.strokeStyle = 'rgba(29,35,48,0.35)';
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillText(opts.startLabel || '', padL, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(opts.endLabel || '', w - padR, h - 4);
  const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '05');
  ctx.beginPath();
  ctx.moveTo(X(0), Y(values[0]));
  values.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(n - 1), h - padB);
  ctx.lineTo(X(0), h - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  for (const s of extra) {
    ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(X(i, s.values.length), Y(v)) : ctx.moveTo(X(i, s.values.length), Y(v))));
    ctx.strokeStyle = s.color || INK; ctx.lineWidth = 1.6; ctx.setLineDash(s.dash ? [4, 3] : []);
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (opts.hover !== undefined && opts.hover !== null && values[opts.hover] !== undefined) {
    const i = opts.hover, hx = X(i), hy = Y(values[i]);
    ctx.strokeStyle = 'rgba(29,35,48,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, h - padB); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke();
    const txt = (opts.label ? opts.label(i) + ' · ' : '') + (opts.fmt ? opts.fmt(values[i]) : nf(values[i]));
    ctx.font = '700 12px "Stadtpuls Rund", Outfit, sans-serif';
    const tw = ctx.measureText(txt).width + 14;
    const bx = Math.max(padL, Math.min(w - padR - tw, hx - tw / 2)), by = Math.max(0, hy - 30);
    ctx.fillStyle = '#1d2330'; roundRect(ctx, bx, by, tw, 20, 6); ctx.fill();
    ctx.fillStyle = '#f6f2ea'; ctx.textAlign = 'left'; ctx.fillText(txt, bx + 7, by + 14);
    return;
  }
  const lx = X(n - 1), ly = Y(values[n - 1]);
  ctx.fillStyle = '#f6f2ea';
  ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
}

// Index des Werts unter der x-Position (CSS-Pixel im Canvas) – passend zu drawLineChart
export function chartIndexAt(canvas, x, n) {
  const w = canvas.clientWidth || 300, padL = 44, padR = 8;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(n - 1, Math.round(((x - padL) / (w - padL - padR)) * (n - 1))));
}

// Säulendiagramm. bars: [{ label, value, color }], opts: fmt, max
export function drawBarChart(canvas, bars, opts = {}) {
  const { ctx, w, h } = prep(canvas);
  const padB = 18, padT = 14;
  const max = opts.max || Math.max(1e-6, ...bars.map((b) => Math.abs(b.value)));
  const bw = (w - 8) / Math.max(1, bars.length);
  ctx.font = FONT; ctx.textAlign = 'center';
  bars.forEach((b, i) => {
    const bh = (Math.abs(b.value) / max) * (h - padB - padT);
    const x = 4 + i * bw + bw * 0.15, y = h - padB - bh;
    ctx.fillStyle = b.color || '#2f8fe0';
    roundRect(ctx, x, y, bw * 0.7, bh, Math.min(4, bw * 0.2));
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(b.label || '', x + bw * 0.35, h - 4);
    if (opts.values !== false) { ctx.fillStyle = '#1d2330'; ctx.fillText(opts.fmt ? opts.fmt(b.value) : nf(b.value), x + bw * 0.35, y - 3); }
  });
}

// Alterspyramide o. Ä.: left/right gleich lang, labels pro Zeile (oben = erste Zeile)
export function drawPyramid(canvas, left, right, labels, opts = {}) {
  const { ctx, w, h } = prep(canvas, 160);
  const rows = Math.max(left.length, right.length);
  const max = Math.max(1e-6, ...left, ...right);
  const mid = w / 2, lab = 30, rh = (h - 4) / rows;
  ctx.font = FONT; ctx.textAlign = 'center';
  for (let r = 0; r < rows; r++) {
    const y = 2 + r * rh;
    const lw = ((left[r] || 0) / max) * (mid - lab / 2 - 4), rw = ((right[r] || 0) / max) * (mid - lab / 2 - 4);
    ctx.fillStyle = opts.leftColor || '#2f8fe0';
    roundRect(ctx, mid - lab / 2 - lw, y + 1, lw, rh - 2, 2); ctx.fill();
    ctx.fillStyle = opts.rightColor || '#f06fae';
    roundRect(ctx, mid + lab / 2, y + 1, rw, rh - 2, 2); ctx.fill();
    ctx.fillStyle = INK; ctx.fillText(labels[r] || '', mid, y + rh / 2 + 4);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// --- HTML/SVG-Helfer
export function svgSpark(values, o = {}) {
  const w = o.w || 120, h = o.h || 32, col = o.color || '#2f8fe0';
  if (!values || values.length < 2) return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
  let min = Math.min(...values), max = Math.max(...values);
  if (o.zero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (max - min < 1e-6) { max += 1; min -= 1; }
  const X = (i) => 2 + (i / (values.length - 1)) * (w - 4), Y = (v) => 2 + (1 - (v - min) / (max - min)) * (h - 4);
  const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${X(0).toFixed(1)},${h} ${pts} ${X(values.length - 1).toFixed(1)},${h}`;
  const zeroLine = o.zero && min < 0 ? `<line x1="0" x2="${w}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="rgba(29,35,48,.25)" stroke-dasharray="3 3"/>` : '';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${zeroLine}${o.fill === false ? '' : `<polygon points="${area}" fill="${col}" opacity="0.14"/>`}<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${o.stroke || 2}" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(values.length - 1).toFixed(1)}" cy="${Y(values[values.length - 1]).toFixed(1)}" r="2.6" fill="${col}"/></svg>`;
}

// Ringdiagramm. parts: [{ value, color }], label: Text in der Mitte
export function svgDonut(parts, o = {}) {
  const s = o.size || 88, t = o.thickness || 12, r = (s - t) / 2, c = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  let off = 0;
  const segs = parts.map((p) => {
    const len = (Math.max(0, p.value) / total) * c;
    const el = `<circle r="${r}" cx="${s / 2}" cy="${s / 2}" fill="none" stroke="${p.color}" stroke-width="${t}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
    return el;
  }).join('');
  return `<svg class="donut" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true"><g transform="rotate(-90 ${s / 2} ${s / 2})"><circle r="${r}" cx="${s / 2}" cy="${s / 2}" fill="none" stroke="rgba(29,35,48,.08)" stroke-width="${t}"/>${segs}</g>${o.label !== undefined ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="donut-l">${o.label}</text>` : ''}</svg>`;
}

// Waagerechte Balken. items: [{ label, value, color, text? }]
export function barsHTML(items, o = {}) {
  const max = o.max || Math.max(1e-6, ...items.map((i) => Math.abs(i.value)));
  return `<div class="hbars">${items.map((i) => `<div class="hb"><span class="hl">${i.label}</span><span class="ht"><i style="width:${Math.min(100, (Math.abs(i.value) / max) * 100).toFixed(1)}%;background:${i.color || '#2f8fe0'}"></i></span><span class="hv num">${i.text ?? nf(i.value)}</span></div>`).join('')}</div>`;
}

export function meterHTML(v, max, color = 'var(--l-blue)') {
  return `<div class="meter"><i style="width:${Math.max(0, Math.min(1, v / Math.max(1e-6, max))) * 100}%;background:${color}"></i></div>`;
}

// Gestapelter Balken. parts: [{ value, color, label }]
export function stackHTML(parts) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  return `<div class="stack">${parts.map((p) => `<i style="width:${((Math.max(0, p.value) / total) * 100).toFixed(2)}%;background:${p.color}" title="${p.label || ''}"></i>`).join('')}</div>`;
}
