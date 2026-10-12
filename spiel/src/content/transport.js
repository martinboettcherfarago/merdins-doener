// Inhalte Verkehr. Besitzer: System-Agent „Verkehr & ÖPNV".
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
import { BUILDINGS } from '../config.js';

Object.assign(BUILDINGS, {
  bus_depot: { name: 'Busdepot', cat: 'transport', size: [2, 2], cost: 6000, upkeep: 50, unlock: 1, buses: 8, power_use: 6, noise: 0.6, desc: 'Heimat der Busse. Danach Buslinien über Haltestellen an der Straße ziehen.' },
  tram_depot: { name: 'Straßenbahndepot', cat: 'transport', size: [3, 2], cost: 14000, upkeep: 90, unlock: 3, trams: 6, power_use: 20, desc: 'Straßenbahnen fahren auf Alleen und Straßen.' },
  train_station: { name: 'Hauptbahnhof', cat: 'transport', size: [4, 2], cost: 30000, upkeep: 160, unlock: 3, tourism: 120, intercity: 1, power_use: 20, noise: 1.1, lv: 8, lvRadius: 8, desc: 'Fernzüge bringen Pendler und Touristen.' },
  airport: { name: 'Flughafen', cat: 'transport', size: [6, 4], cost: 90000, upkeep: 420, unlock: 5, tourism: 420, offBoost: 20, power_use: 60, water_use: 20, noise: 2.5, lv: -18, lvRadius: 10, desc: 'Das Tor zur Welt. Sehr laut.' },
  ferry_pier: { name: 'Fähranleger', cat: 'transport', size: [1, 1], cost: 3000, upkeep: 20, unlock: 2, needsWater: true, desc: 'Fähren verbinden Ufer miteinander.' },
  parking: { name: 'Parkhaus', cat: 'transport', size: [1, 1], cost: 4000, upkeep: 25, unlock: 2, parking: 200, comBoost: 4, lvRadius: 4, desc: 'Weniger Parkplatzsuche, mehr Kundschaft.' },
  taxi_depot: { name: 'Taxizentrale', cat: 'transport', size: [1, 1], cost: 3500, upkeep: 30, unlock: 2, taxis: 10, desc: 'Taxis fahren Touristen und Spätheimkehrer.' },
  metro_hub: { name: 'Pulsbahn-Umsteigebahnhof', cat: 'transit', size: [2, 1], cost: 6000, upkeep: 30, unlock: 3, onRoad: false, stationCapacity: 30, desc: 'Große Station: doppelte Kapazität und schnelleres Umsteigen.' },
});
