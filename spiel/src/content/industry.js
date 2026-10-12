// Inhalte Wirtschaft & Logistik. Besitzer: System-Agent „Wirtschaft & Industrie".
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
// Felder wie goods/cargo/process werden von sim/systems/industry.js ausgewertet.
import { BUILDINGS } from '../config.js';

Object.assign(BUILDINGS, {
  warehouse: { name: 'Lagerhalle', cat: 'industry', size: [2, 2], cost: 6000, upkeep: 40, unlock: 2, storage: 400, power_use: 6, noise: 0.5, desc: 'Puffert Waren zwischen Industrie und Gewerbe. Weniger Lieferverkehr, stabilere Versorgung.' },
  food_factory: { name: 'Lebensmittelfabrik', cat: 'industry', size: [2, 2], cost: 12000, upkeep: 90, unlock: 3, process: 'farm', jobs: 60, power_use: 18, water_use: 14, pollution: 0.6, desc: 'Verarbeitet Ernte von Bauernhöfen zu Lebensmitteln – mehr Wert pro Lieferung.' },
  sawmill: { name: 'Sägewerk', cat: 'industry', size: [2, 2], cost: 10000, upkeep: 75, unlock: 3, process: 'forest', jobs: 50, power_use: 14, noise: 1, pollution: 0.5, desc: 'Macht aus Holz Bretter und Möbel.' },
  steelworks: { name: 'Stahlwerk', cat: 'industry', size: [3, 2], cost: 24000, upkeep: 170, unlock: 4, process: 'mine', jobs: 120, power_use: 40, water_use: 20, pollution: 3, noise: 1.2, desc: 'Verhüttet Erz. Viele Jobs, viel Rauch.' },
  refinery: { name: 'Raffinerie', cat: 'industry', size: [3, 2], cost: 26000, upkeep: 180, unlock: 4, process: 'oil', jobs: 110, power_use: 30, water_use: 24, pollution: 3.5, noise: 1, desc: 'Verarbeitet Rohöl zu Kunststoff und Treibstoff.' },
  cargo_rail: { name: 'Güterbahnhof', cat: 'industry', size: [3, 2], cost: 20000, upkeep: 120, unlock: 3, cargo: 900, power_use: 10, noise: 1.3, desc: 'Exportiert Waren per Zug. Entlastet die Autobahn vom Lkw-Verkehr.' },
  cargo_harbor: { name: 'Frachthafen', cat: 'industry', size: [3, 3], cost: 36000, upkeep: 200, unlock: 4, cargo: 2000, needsWater: true, power_use: 16, noise: 1.4, desc: 'Containerhafen am Wasser. Großer Export, gute Preise.' },
  market_hall: { name: 'Markthalle', cat: 'industry', size: [2, 1], cost: 5000, upkeep: 30, unlock: 2, comBoost: 8, lvRadius: 6, goodsDemand: 40, desc: 'Regionale Waren aus der Stadt. Belebt das Gewerbe im Umkreis.' },
});
