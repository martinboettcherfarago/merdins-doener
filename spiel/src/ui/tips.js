// Schöne Tooltips für Bedienelemente: <button data-tip="Titel" data-tip-desc="Text" data-key="P" data-tip-pos="left">
// Ein gemeinsamer Tooltip, verzögert eingeblendet, an den Bildschirmrand angepasst. Bei Berührung nicht aktiv.
let el = null, timer = 0, cur = null, enabled = true;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'uitip';
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  document.getElementById('app').appendChild(el);
  return el;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function show(target) {
  const t = ensure();
  const title = target.dataset.tip, desc = target.dataset.tipDesc, key = target.dataset.key;
  if (!title) return;
  t.innerHTML = `<div class="tt">${esc(title)}${key ? `<kbd>${esc(key)}</kbd>` : ''}</div>${desc ? `<div class="td">${esc(desc)}</div>` : ''}`;
  t.hidden = false;
  t.className = '';
  const r = target.getBoundingClientRect();
  const w = t.offsetWidth, h = t.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let pos = target.dataset.tipPos || 'top';
  const fits = { top: r.top - h - 10 > 4, bottom: r.bottom + h + 10 < vh - 4, left: r.left - w - 10 > 4, right: r.right + w + 10 < vw - 4 };
  if (!fits[pos]) pos = ['top', 'bottom', 'left', 'right'].find((p) => fits[p]) || 'top';
  let x, y;
  if (pos === 'top' || pos === 'bottom') { x = r.left + r.width / 2 - w / 2; y = pos === 'top' ? r.top - h - 9 : r.bottom + 9; }
  else { y = r.top + r.height / 2 - h / 2; x = pos === 'left' ? r.left - w - 9 : r.right + 9; }
  x = Math.max(6, Math.min(vw - w - 6, x)); y = Math.max(6, Math.min(vh - h - 6, y));
  t.style.left = x + 'px'; t.style.top = y + 'px';
  t.className = 'pos-' + pos;
  requestAnimationFrame(() => t.classList.add('show'));
}

export function hideTip() {
  clearTimeout(timer);
  cur = null;
  if (el) { el.hidden = true; el.className = ''; }
}

export function setTipsEnabled(v) { enabled = v; if (!v) hideTip(); }

let bound = false;
export function bindTips() {
  if (bound) return;
  bound = true;
  document.addEventListener('pointerover', (e) => {
    if (!enabled || e.pointerType === 'touch') return;
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === cur) return;
    hideTip();
    if (!t) return;
    cur = t;
    timer = setTimeout(() => { if (cur === t && document.body.contains(t)) show(t); }, t.dataset.tipFast ? 120 : 420);
  });
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('wheel', hideTip, { passive: true, capture: true });
  window.addEventListener('blur', hideTip);
}
