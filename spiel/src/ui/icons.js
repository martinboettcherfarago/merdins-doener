// Linien-Icons (24×24, Kontur), passend zur Netzplan-Optik.
const P = {
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
  bulldoze: '<path d="M3 17h11l3-6h4M7 17l-2 4h12M14 11 9 6l-4 4 5 5"/>',
  select: '<path d="M5 3l14 8-6 2-2 6L5 3Z"/>',
  budget: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  policies: '<path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
  news: '<path d="M4 5h12v14H6a2 2 0 0 1-2-2V5Z"/><path d="M16 9h3v8a2 2 0 0 1-2 2M7 9h6M7 13h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  save: '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5l12 7-12 7V5Z"/>',
  fast: '<path d="M4 6l8 6-8 6V6ZM12 6l8 6-8 6V6Z"/>',
  faster: '<path d="M2 6l6 6-6 6V6ZM9 6l6 6-6 6V6ZM16 6l6 6-6 6V6Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
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
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5 12 22l10-4.5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  line: '<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7 16.5 11 12h4l2.2-4"/>',
  station: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  dezone: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>',
};

export function icon(name, size = 20, stroke = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// Logo: Pulslinie, die in eine Bahnlinie übergeht
export function logo(size = 34, color = '#f6f2ea') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 22h7l3-9 5 16 4-11 2 4h9" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="35" cy="22" r="3" fill="#e8543f"/></svg>`;
}
