// Kleine Liniendiagramme auf Canvas (Verlauf der Stadtwerte).
export function drawLineChart(canvas, values, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 120;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const color = opts.color || '#2f8fe0';
  const ink = '#7a8294';
  const padL = 44, padR = 8, padT = 10, padB = 18;
  if (!values.length) {
    ctx.fillStyle = ink; ctx.font = '12px Barlow, sans-serif';
    ctx.fillText('Noch keine Daten – ein Spieltag vergeht in 30 Sekunden.', 8, h / 2);
    return;
  }
  let min = Math.min(...values), max = Math.max(...values);
  if (opts.zero) min = Math.min(0, min);
  if (max - min < 1e-6) { max += 1; min -= opts.zero ? 0 : 1; }
  const span = max - min;
  const X = (i) => padL + (values.length === 1 ? (w - padL - padR) : (i / (values.length - 1)) * (w - padL - padR));
  const Y = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);
  // Raster
  ctx.strokeStyle = 'rgba(29,35,48,0.08)';
  ctx.lineWidth = 1;
  ctx.fillStyle = ink;
  ctx.font = '600 11px "Barlow Condensed", Barlow, sans-serif';
  ctx.textAlign = 'right';
  for (let k = 0; k <= 3; k++) {
    const v = min + (span * k) / 3;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(opts.fmt ? opts.fmt(v) : Math.round(v).toLocaleString('de-DE'), padL - 6, y + 4);
  }
  if (opts.zero && min < 0) {
    ctx.strokeStyle = 'rgba(29,35,48,0.35)';
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillText(opts.startLabel || '', padL, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(opts.endLabel || '', w - padR, h - 4);
  // Fläche
  const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '05');
  ctx.beginPath();
  ctx.moveTo(X(0), Y(values[0]));
  values.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(values.length - 1), h - padB);
  ctx.lineTo(X(0), h - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  const lx = X(values.length - 1), ly = Y(values[values.length - 1]);
  ctx.fillStyle = '#f6f2ea';
  ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
}
