// Linien-Icons (24×24, Kontur), passend zur Netzplan-Optik.
// icon(name, size, stroke) liefert ein SVG als HTML-Text. Unbekannte Namen ergeben ein leeres Symbol;
// hasIcon(name) prüft vorher. Andere Module dürfen eigene Pfade über registerUiIcon(name, pfad) ergänzen.
const P = {
  // --- Kategorien
  roads: '<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',
  zones: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  power: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  water: '<path d="M12 3c4 5 6 8.2 6 11a6 6 0 0 1-12 0c0-2.8 2-6 6-11Z"/>',
  garbage: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  services: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="M12 8v8M8 12h8"/>',
  education: '<path d="M2 9l10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  parks: '<path d="M12 21v-6M12 15c-4 0-6-2.5-6-5.5S8.5 3 12 3s6 3.5 6 6.5S16 15 12 15Z"/><path d="M8 21h8"/>',
  transit: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8.5 21 10 17M15.5 21 14 17"/><circle cx="9" cy="13.5" r="0.8" fill="currentColor"/><circle cx="15" cy="13.5" r="0.8" fill="currentColor"/>',
  landmarks: '<path d="M12 2v4M12 6l3 3-3 13-3-13 3-3ZM7 22h10"/>',
  industry: '<path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17H3Z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  transport: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M7 21l1.5-4M17 21l-1.5-4"/><circle cx="8" cy="14" r="0.9" fill="currentColor"/><circle cx="16" cy="14" r="0.9" fill="currentColor"/><path d="M8 7h8"/>',
  safety: '<path d="M12 3 3 19h18L12 3Z"/><path d="M12 9.5v4.5M12 17h.01"/>',
  districts: '<path d="M4 5h7v6H4ZM13 5h7v9h-7ZM4 13h7v6H4ZM13 16h7v3h-7Z"/>',
  // --- Werkzeuge
  bulldoze: '<path d="M3 17h11l3-6h4M7 17l-2 4h12M14 11 9 6l-4 4 5 5"/>',
  select: '<path d="M5 3l14 8-6 2-2 6L5 3Z"/>',
  dezone: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>',
  line: '<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7 16.5 11 12h4l2.2-4"/>',
  station: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  brush: '<path d="M14 4l6 6-8 8H6v-6l8-8Z"/><path d="M12 6l6 6"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  // --- Panels
  budget: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  policies: '<path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
  news: '<path d="M4 5h12v14H6a2 2 0 0 1-2-2V5Z"/><path d="M16 9h3v8a2 2 0 0 1-2 2M7 9h6M7 13h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  economy: '<path d="M3 20h18M5 20V12M10 20V8M15 20v-5M20 20V5"/><path d="M4 9l5-4 5 4 6-5"/>',
  citizens: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 2 5 5"/>',
  people: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
  weather: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1.1 1.1M13.6 4.4l-1.1 1.1"/><path d="M8 20h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4 1.2A3 3 0 0 0 8 20Z"/>',
  progression: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4v4h-4Z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4v4h-4Z"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 12h16M7 21v-3M17 21v-3M8 7h8"/><circle cx="8" cy="15" r="0.9" fill="currentColor"/><circle cx="16" cy="15" r="0.9" fill="currentColor"/>',
  // --- System
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  save: '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  advisor: '<circle cx="12" cy="8" r="3.6"/><path d="M5 21c.6-4 3.4-6.5 7-6.5s6.4 2.5 7 6.5"/><path d="M15.5 3.5 18 2M17 6.5h2.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.6"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>',
  minimap: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 14c4-1 5-5 9-5s4.5 3 8 2M9 20.5l2-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5 12 22l10-4.5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  chevronL: '<path d="M15 5 8 12l7 7"/>',
  chevronR: '<path d="M9 5l7 7-7 7"/>',
  chevronU: '<path d="M5 15l7-7 7 7"/>',
  chevronD: '<path d="M5 9l7 7 7-7"/>',
  arrowR: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  pin: '<path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  warn: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  cloud: '<path d="M7 19h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 19Z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/>',
  storm: '<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14Z"/><path d="M12 14l-2 4h3l-2 4"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3l3 7M21 12l-7 3M12 21l-3-7M3 12l7-3M17.5 5.5 14 10M18.5 17.5 14 15M6.5 18.5 10 14M5.5 6.5 10 10"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  orbit: '<ellipse cx="12" cy="12" rx="9.5" ry="4.5"/><circle cx="12" cy="12" r="2.5"/><path d="M19 8.5l2.2-1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  house: '<path d="M4 11l8-7 8 7v9H4Z"/><path d="M10 20v-5h4v5"/>',
  shop: '<path d="M4 10h16v10H4ZM3 10l2-6h14l2 6"/><path d="M9 20v-5h6v5"/>',
  office: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  tree: '<path d="M12 21v-5M12 3 6 12h3l-3 4h12l-3-4h3L12 3Z"/>',
  // --- Infoansichten
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.6 2.4-4.6.3 1.6 1 2.6 2 3C11 9 11 6 12 3Z"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4V4ZM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6V4Z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.6.8-2.6 1.9 0 2.6 5.3 1.3 5.3 4 0 1.1-1.1 1.9-2.7 1.9-1.2 0-2.2-.5-2.7-1.4M12 6.5v1.8M12 15.8v1.7"/>',
  smoke: '<path d="M4 16h13a3 3 0 0 0 0-6 4 4 0 0 0-7.6-1.6A3.5 3.5 0 0 0 4 12v4ZM6 20h10"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4ZM17 9l5 6M22 9l-5 6"/>',
  car: '<path d="M5 16h14v-4l-2-5H7l-2 5v4ZM5 12h14M7 19v-3M17 19v-3"/>',
  mask: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8.5 15.5c2 1.5 5 1.5 7 0"/>',
  // --- Zeit
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5l12 7-12 7V5Z"/>',
  fast: '<path d="M4 6l8 6-8 6V6ZM12 6l8 6-8 6V6Z"/>',
  faster: '<path d="M2 6l6 6-6 6V6ZM9 6l6 6-6 6V6ZM16 6l6 6-6 6V6Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  // --- Runde 3: Stadt-Check, Stadtverwaltung, Untergrund
  pulse: '<path d="M2 12h4l2.5-6 4 12 3-8 1.5 2H22"/>',
  city: '<path d="M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13M13.5 10h2M13.5 13.5h2M13.5 17h2M7 12h1M7 15.5h1"/>',
  underground: '<path d="M3 20V12a9 9 0 0 1 18 0v8"/><path d="M7 20v-7a5 5 0 0 1 10 0v7M3 20h18"/><path d="M10 15.5h4"/>',
  ubahn: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8.5 7.5v5.5a3.5 3.5 0 0 0 7 0V7.5"/>',
};

export function registerUiIcon(name, path) { if (!P[name]) P[name] = path; }
export const hasIcon = (name) => !!P[name];

export function icon(name, size = 20, stroke = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.layers}</svg>`;
}

// Eigenes Symbol (SVG-Text) oder Name aus der Liste – für Register-Einträge mit icon-Feld.
export function iconAny(v, fallback = 'layers', size = 20, stroke = 2) {
  if (v && typeof v === 'string' && v.trim().startsWith('<')) return v;
  return icon(v && P[v] ? v : fallback, size, stroke);
}

// Runde 3b (Vorlage): bunte, gefüllte Abzeichen für Pillen-Chips und Karten – Stern (Rang), Münze (Kasse),
// Figur (Einwohner), Gesichter (Glück: smile|meh|sad), Sonne. Ohne Verläufe mit IDs, damit mehrfaches Einbetten sicher ist.
const B = {
  star: '<path d="M20 3.5l4.9 10 11 1.6-8 7.8 1.9 11L20 28.7 10.2 33.9l1.9-11-8-7.8 11-1.6L20 3.5Z" fill="#f7a90c" stroke="#d27f00" stroke-width="2" stroke-linejoin="round"/><path d="M20 7.5l3.6 7.4 8.1 1.2-2.6 2.5C24 17 17 19 12.2 24.9l.6-3.4-5.9-5.7 8.1-1.2L20 7.5Z" fill="#ffd34d"/>',
  coin: '<circle cx="20" cy="20" r="17" fill="#e99a06"/><circle cx="20" cy="18.6" r="15.6" fill="#ffc21f"/><circle cx="20" cy="18.6" r="11.6" fill="none" stroke="#e99a06" stroke-width="2"/><path d="M24.6 13.8a6.4 6.4 0 1 0 0 9.6M12.6 17h9M12.6 20.4h9" fill="none" stroke="#b86a00" stroke-width="2.6" stroke-linecap="round"/>',
  person: '<circle cx="20" cy="20" r="18" fill="#ffe0e4"/><path d="M8 34.5c1.2-7 6-10.5 12-10.5s10.8 3.5 12 10.5A17.9 17.9 0 0 1 20 38c-4.6 0-8.8-1.3-12-3.5Z" fill="#e5484d"/><circle cx="20" cy="15.5" r="7" fill="#f8c49b"/><path d="M13 14.6c0-4.6 3.2-7.4 7.2-7.4s6.8 2.6 6.8 6.4c-2.4.4-5.6-.6-7.6-2.6-1.4 2-3.8 3.4-6.4 3.6Z" fill="#7a3b1f"/>',
  smile: '<circle cx="20" cy="20" r="17" fill="#ffc21f" stroke="#e99a06" stroke-width="2"/><circle cx="14.4" cy="16.4" r="2.4" fill="#5a2a00"/><circle cx="25.6" cy="16.4" r="2.4" fill="#5a2a00"/><path d="M12.4 23.2c2 3.6 4.6 5.2 7.6 5.2s5.6-1.6 7.6-5.2" fill="none" stroke="#5a2a00" stroke-width="2.6" stroke-linecap="round"/>',
  meh: '<circle cx="20" cy="20" r="17" fill="#ffd66b" stroke="#e5a400" stroke-width="2"/><circle cx="14.4" cy="16.4" r="2.4" fill="#5a2a00"/><circle cx="25.6" cy="16.4" r="2.4" fill="#5a2a00"/><path d="M13.6 25.6h12.8" fill="none" stroke="#5a2a00" stroke-width="2.6" stroke-linecap="round"/>',
  sad: '<circle cx="20" cy="20" r="17" fill="#ff9a7a" stroke="#e5484d" stroke-width="2"/><circle cx="14.4" cy="16.4" r="2.4" fill="#5a1a10"/><circle cx="25.6" cy="16.4" r="2.4" fill="#5a1a10"/><path d="M13 28c2-3 4.4-4.4 7-4.4s5 1.4 7 4.4" fill="none" stroke="#5a1a10" stroke-width="2.6" stroke-linecap="round"/>',
  sun: '<g stroke="#ffb000" stroke-width="3" stroke-linecap="round"><path d="M20 2.5v5M20 32.5v5M2.5 20h5M32.5 20h5M7.6 7.6l3.5 3.5M28.9 28.9l3.5 3.5M7.6 32.4l3.5-3.5M28.9 11.1l3.5-3.5"/></g><circle cx="20" cy="20" r="9.5" fill="#ffc21f" stroke="#ff9d00" stroke-width="2"/>',
};
export function badge(name, size = 32) {
  return `<svg class="bdg bdg-${name}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${B[name] || B.star}</svg>`;
}

// Logo: Pulslinie, die in eine Bahnlinie übergeht
export function logo(size = 34, color = '#ffffff') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 22h7l3-9 5 16 4-11 2 4h9" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="35" cy="22" r="3.2" fill="#ffb020"/></svg>`;
}
