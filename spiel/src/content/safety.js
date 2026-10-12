// Inhalte Wetter & Katastrophenschutz. Besitzer: System-Agent „Wetter & Katastrophen".
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
import { BUILDINGS } from '../config.js';

Object.assign(BUILDINGS, {
  disaster_center: { name: 'Katastrophenschutz', cat: 'safety', size: [2, 2], cost: 16000, upkeep: 110, unlock: 3, response: 1, power_use: 10, desc: 'Räumt nach Katastrophen auf und rettet Menschen.' },
  shelter: { name: 'Notunterkunft', cat: 'safety', size: [2, 1], cost: 6000, upkeep: 30, unlock: 3, shelterCap: 800, power_use: 4, water_use: 4, desc: 'Schützt Bewohner bei Stürmen und Fluten.' },
  warning_siren: { name: 'Warnsirene', cat: 'safety', size: [1, 1], cost: 900, upkeep: 4, unlock: 2, warnRadius: 12, desc: 'Warnt rechtzeitig – weniger Schäden.' },
  weather_station: { name: 'Wetterstation', cat: 'safety', size: [1, 1], cost: 2500, upkeep: 12, unlock: 1, forecast: 1, desc: 'Sagt Unwetter und Fluten Tage im Voraus an.' },
  snow_depot: { name: 'Winterdienst', cat: 'safety', size: [1, 1], cost: 3000, upkeep: 26, unlock: 2, snowPlows: 6, desc: 'Räumt im Winter die Straßen.' },
  flood_barrier: { name: 'Hochwasserschutz', cat: 'safety', size: [1, 1], cost: 2000, upkeep: 6, unlock: 2, needsWater: true, floodProtect: 6, desc: 'Schützt Ufer im Umkreis vor Hochwasser.' },
});
