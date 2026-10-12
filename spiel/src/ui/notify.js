// Benachrichtigungszentrale: sammelt wichtige Meldungen (Stadtfunk ohne Plaudereien, Meilensteine, Ereignisse,
// Katastrophen) mit Ort und Zeit. Andere Module melden sich über den Ereignisbus:
//   emit('notify', { title, text, mood: 'good'|'bad'|'info', icon?, where?: { x, y }, key? })
// key fasst gleichartige Meldungen zusammen. Dazu die „Lage": laufend berechnete Probleme der Stadt (problems()).
import { on } from '../registry.js';
import { fmt } from '../util.js';
import { icon, iconAny } from './icons.js';
import { DISASTER_NAMES } from './meta.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = {
  fire: ['Feuer', 'flame'], money: ['Finanzen', 'coin'], transit: ['Pulsbahn', 'transit'], event: ['Ereignis', 'news'], card: ['Wochenkarte', 'star'],
  report: ['Wochenbilanz', 'budget'], info: ['Stadtverwaltung', 'info'], milestone: ['Meilenstein', 'trophy'], disaster: ['Katastrophe', 'warn'],
  weather: ['Wetter', 'weather'], traffic: ['Verkehr', 'car'], health: ['Gesundheit', 'cross'], crime: ['Sicherheit', 'shield'], economy: ['Wirtschaft', 'economy'],
  industry: ['Industrie', 'industry'], citizens: ['Bürger', 'citizens'], achievement: ['Erfolg', 'trophy'], district: ['Bezirk', 'districts'],
};
let seq = 0;

export class Notifier {
  constructor(ui) {
    this.ui = ui;
    this.items = [];
    this.unread = 0;
    this.filter = 'all';
    this.unbind = [on('notify', (n) => this.push(n || {})), on('disaster', (d) => this.disaster(d || {}))];
    // Bestehende Meldungen des Spielstands übernehmen (ohne Plaudereien)
    for (const n of ui.g.newsLog) if (n.kind !== 'chatter') this.fromNews(n, true);
    this.unread = 0;
  }
  dispose() { for (const u of this.unbind) u(); }

  push(n, quiet = false) {
    const g = this.ui.g;
    const now = g.time;
    if (n.key) {
      const old = this.items.find((x) => x.key === n.key && now - x.time < 180);
      if (old) {
        Object.assign(old, { text: n.text ?? old.text, title: n.title ?? old.title, time: now, count: (old.count || 1) + 1 });
        if (old.read) { old.read = false; this.unread++; }
        this.items.splice(this.items.indexOf(old), 1); this.items.unshift(old);
        if (!quiet) this.changed();
        return old;
      }
    }
    const it = { id: ++seq, time: n.time ?? now, title: n.title || '', text: n.text || '', mood: n.mood || 'info', icon: n.icon || 'info', where: n.where || null, key: n.key || null, kind: n.kind || 'info', read: false };
    this.items.unshift(it);
    if (this.items.length > 150) this.items.length = 150;
    this.unread++;
    if (!quiet) this.changed();
    return it;
  }

  fromNews(n, quiet = false) {
    const [title, ic] = KIND[n.kind] || ['Stadtfunk', 'news'];
    const where = n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : null;
    return this.push({ title, text: n.text, mood: n.mood, icon: ic, where, kind: n.kind, time: n.time }, quiet);
  }

  disaster(d) {
    if (d.phase !== 'warn' && d.phase !== 'start') return;
    const name = DISASTER_NAMES[d.type] || d.name || 'Katastrophe';
    const where = d.x !== undefined ? { x: Math.round(d.x), y: Math.round(d.y) } : null;
    const it = this.push({ title: d.phase === 'warn' ? `Warnung: ${name}` : name, text: d.text || (d.phase === 'warn' ? `${name} angekündigt. Notunterkünfte und Rettungskräfte bereithalten.` : `${name} trifft die Stadt!`), mood: 'bad', icon: 'warn', where, kind: 'disaster', key: `dis:${d.type}:${d.phase}` });
    if (d.phase === 'start' && this.ui.toast) this.ui.toast(`${name}!`, 'bad', { where, icon: 'warn' });
    return it;
  }

  markRead() { for (const it of this.items) it.read = true; this.unread = 0; this.changed(); }
  clear() { this.items = []; this.unread = 0; this.changed(); }
  changed() { this.ui.refreshBadges && this.ui.refreshBadges(); if (this.ui.panel === 'notes') this.ui.renderPanel(); }

  html() {
    const ui = this.ui, g = ui.g;
    const probs = problems(g);
    const list = this.items.filter((it) => this.filter === 'all' || (this.filter === 'bad' ? it.mood === 'bad' : !!it.where));
    const when = (t) => { const d = Math.floor(t / 1440), h = String(Math.floor((t % 1440) / 60)).padStart(2, '0'), m = String(Math.floor(t % 60)).padStart(2, '0'); return d === g.day() ? `heute, ${h}:${m}` : `Tag ${d}, ${h}:${m}`; };
    return `
<div class="sec"><h3>Lage der Stadt</h3>${probs.length ? `<div class="probs">${probs.map((p) => `<button class="prob ${p.sev}" data-act="prob" data-id="${p.id}">${icon(p.icon, 16, 2.2)}<span class="pt">${esc(p.text)}</span>${p.view ? `<span class="pv">${icon('eye', 14)}</span>` : ''}</button>`).join('')}</div>` : `<div class="allgood">${icon('check', 18, 2.6)}<span>Keine akuten Probleme. Die Stadt läuft rund.</span></div>`}</div>
<div class="sec"><h3>Meldungen</h3>
<div class="chips filt">${[['all', 'Alle'], ['bad', 'Wichtig'], ['where', 'Mit Ort']].map(([k, n]) => `<button class="chip${this.filter === k ? ' on' : ''}" data-act="nfilter" data-v="${k}">${n}</button>`).join('')}<span class="grow"></span>${this.items.length ? '<button class="chip" data-act="nclear">Leeren</button>' : ''}</div>
${list.length ? `<div class="notes">${list.slice(0, 60).map((it) => `<div class="note ${it.mood}${it.read ? '' : ' unread'}"><span class="ni">${iconAny(it.icon, 'info', 16, 2.2)}</span><div class="nb"><div class="nt">${esc(it.title)}${it.count > 1 ? ` <span class="cnt">×${it.count}</span>` : ''}<span class="nw">${when(it.time)}</span></div><div class="nx">${esc(it.text)}</div></div>${it.where ? `<button class="mini" data-act="goto" data-x="${it.where.x}" data-y="${it.where.y}" data-tip="Hinfliegen" data-tip-fast="1">${icon('pin', 15, 2.2)}</button>` : ''}</div>`).join('')}</div>` : '<p class="empty">Noch keine Meldungen.</p>'}</div>`;
  }

  click(act, el) {
    const ui = this.ui;
    if (act === 'nfilter') { this.filter = el.dataset.v; return true; }
    if (act === 'nclear') { this.clear(); return true; }
    if (act === 'goto') { ui.focusTile(+el.dataset.x, +el.dataset.y); return false; }
    if (act === 'prob') { const p = problems(ui.g).find((x) => x.id === el.dataset.id); if (p) ui.runAction(p); return true; }
    return false;
  }
}

// Laufende Probleme der Stadt (für Meldungen, Lagezeile und Ratgeber)
export function problems(g) {
  const s = g.stats, out = [];
  const add = (id, sev, ic, text, extra = {}) => out.push({ id, sev, icon: ic, text, ...extra });
  if (s.burning) add('burning', 'bad', 'flame', `${fmt(s.burning)} ${s.burning === 1 ? 'Gebäude brennt' : 'Gebäude brennen'}`, { view: 'fire', cat: 'services', count: s.burning });
  if (s.unpowered) add('power', s.unpowered > 8 ? 'bad' : 'warn', 'power', `${fmt(s.unpowered)} ohne Strom`, { view: 'power', cat: 'power', count: s.unpowered });
  if (s.unwatered) add('water', s.unwatered > 8 ? 'bad' : 'warn', 'water', `${fmt(s.unwatered)} ohne Wasser`, { view: 'water', cat: 'water', count: s.unwatered });
  if (s.garbageProb) add('garbage', s.garbageProb > 10 ? 'bad' : 'warn', 'garbage', `${fmt(s.garbageProb)} mit Müllproblem`, { view: 'garbage', cat: 'garbage', count: s.garbageProb });
  if (s.noRoad) add('noroad', 'warn', 'roads', `${fmt(s.noRoad)} ohne Straßenanschluss`, { cat: 'roads', count: s.noRoad });
  if (s.abandoned > 2) add('abandoned', 'warn', 'house', `${fmt(s.abandoned)} verlassene Gebäude`, { view: 'happiness', count: s.abandoned });
  const u = g.util;
  if (u.powerSupply > 0 && u.powerDemand > u.powerSupply * 0.92 && !s.unpowered) add('powercap', 'warn', 'power', `Stromnetz zu ${Math.round((u.powerDemand / u.powerSupply) * 100)} % ausgelastet`, { cat: 'power', count: 1 });
  if (u.waterSupply > 0 && u.waterDemand > u.waterSupply * 0.92 && !s.unwatered) add('watercap', 'warn', 'water', `Wasser zu ${Math.round((u.waterDemand / u.waterSupply) * 100)} % ausgelastet`, { cat: 'water', count: 1 });
  let over = 0, overSt = null;
  for (const st of g.transit.stations.values()) if (st.over > 0.02) { over++; if (!overSt || st.over > overSt.over) overSt = st; }
  if (over) add('stations', 'bad', 'transit', `${over} ${over === 1 ? 'Station' : 'Stationen'} überfüllt`, { panel: 'transit', where: overSt ? { x: overSt.x, y: overSt.y } : null, count: over });
  if (!g.sandbox && g.lastBudget && g.lastBudget.net < 0 && g.money < Math.max(5000, -g.lastBudget.net * 6)) add('budget', g.money < 0 ? 'bad' : 'warn', 'coin', `Haushalt ${fmt(Math.round(g.lastBudget.net))} € / Tag`, { panel: 'budget', count: 1 });
  if (s.pop > 300 && s.trafficFlow < 0.7) add('traffic', 'warn', 'car', `Verkehrsfluss nur ${Math.round(s.trafficFlow * 100)} %`, { view: 'traffic', count: 1 });
  return out;
}
