// Zentrale Erweiterungspunkte. Module registrieren sich beim Import, der Kern liest die Listen.
// So können Systeme, Ansichten, Panels und Werkzeuge hinzukommen, ohne Kerndateien zu ändern.

// --- Simulation
export const SYSTEMS = [];            // { id, init(g), step(g, minutes), hourly(g, h), daily(g, day), weekly(g), serialize(g), load(g, data), renderables(g) }
export const SERVICE_TYPES_EXTRA = []; // zusätzliche Abdeckungsarten, z. B. 'deathcare'
export const HAPPINESS_FACTORS = [];   // fn(g, b, i) → [label, wert] | null
export const LANDVALUE_TERMS = [];     // fn(g, i) → zusätzlicher Bodenwert
export const DEMAND_MODIFIERS = [];    // fn(g, demand) → verändert demand[1..4] direkt
export const BUDGET_LINES = [];        // { id, label, kind: 'income'|'expense', amount(g) → € pro Tag }
export const BUILDING_PROBLEMS = [];   // fn(g, b) → Icon-ID (String) | null – für Problemsymbole
export const CAPACITY_MODIFIERS = [];  // fn(g, b, cap) → neue Kapazität

// --- Darstellung
export const VIEWS = [];               // Klassen: new View(engine); optional frame(dt, simDt, time, night), dispose()
export const ICONS = [];               // { id, draw(ctx, cx, cy, r) } – Symbol-Atlas
export const OVERLAYS_EXTRA = [];      // { id, name, icon, bad?, field?(g) → Float32Array(0..1), building?(g, b) → hex|null, text }

// --- Oberfläche und Werkzeuge
export const PANELS = [];              // { id, title, icon, order, render(ui) → html, click?(ui, act, el), afterRender?(ui) }
export const TOOLS = {};               // kind → { down(input, t, e), move(input, t, e), up(input, t, e), hover(input, t), cancel(input), key?(input, e) }
export const TRAY_ITEMS = [];          // { cat, item(g) → Tray-Eintrag } – zusätzliche Werkzeuge in der Werkzeugleiste
export const INSPECTORS = [];          // fn(ui, sel) → html | null – zusätzliche Abschnitte im Inspektor
export const MENU_SECTIONS = [];       // fn(menu) → html – zusätzliche Abschnitte im Hauptmenü (z. B. Szenarien)

// --- Inhalte
export const CARDS_EXTRA = [];
export const EVENTS_EXTRA = [];
export const CHATTER_EXTRA = [];       // { when(g) → bool, texts: [] }
export const POLICIES_EXTRA = [];

export function registerSystem(s) { if (!SYSTEMS.find((x) => x.id === s.id)) SYSTEMS.push(s); return s; }
export function registerView(V) { if (!VIEWS.includes(V)) VIEWS.push(V); return V; }
export function registerPanel(p) { if (!PANELS.find((x) => x.id === p.id)) PANELS.push(p); return p; }
export function registerTool(kind, t) { TOOLS[kind] = t; return t; }
export function registerIcon(icon) { if (!ICONS.find((x) => x.id === icon.id)) ICONS.push(icon); return icon; }
export function registerOverlay(o) { if (!OVERLAYS_EXTRA.find((x) => x.id === o.id)) OVERLAYS_EXTRA.push(o); return o; }
export function registerServiceType(t) { if (!SERVICE_TYPES_EXTRA.includes(t)) SERVICE_TYPES_EXTRA.push(t); }

// Kleiner Ereignisbus für lose Kopplung zwischen Systemen und Ansichten (z. B. 'disaster', 'season').
const bus = {};
export function on(ev, fn) { (bus[ev] ||= []).push(fn); return () => { bus[ev] = bus[ev].filter((f) => f !== fn); }; }
export function emit(ev, ...a) { for (const f of bus[ev] || []) f(...a); }
