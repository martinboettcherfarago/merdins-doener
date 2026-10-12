// Inhalte Bürger & Dienste. Besitzer: System-Agent „Bürger & Dienste".
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
import { BUILDINGS } from '../config.js';
import { registerServiceType } from '../registry.js';

registerServiceType('deathcare');

Object.assign(BUILDINGS, {
  kindergarten: { name: 'Kita', cat: 'education', size: [1, 1], cost: 1800, upkeep: 22, unlock: 1, service: { type: 'edu', radius: 6, capacity: 900, eduMax: 0.25 }, resBoost: 4, parkRadius: 5, power_use: 2, water_use: 2, desc: 'Familien ziehen gern in die Nähe.' },
  highschool: { name: 'Gymnasium', cat: 'education', size: [2, 2], cost: 11000, upkeep: 120, unlock: 3, service: { type: 'edu', radius: 14, capacity: 5000, eduMax: 0.8 }, power_use: 10, water_use: 8, desc: 'Höhere Bildung für Büros und Wohntürme.' },
  research: { name: 'Forschungszentrum', cat: 'education', size: [2, 2], cost: 30000, upkeep: 220, unlock: 5, offBoost: 25, eduCity: 0.06, lv: 10, lvRadius: 8, power_use: 30, water_use: 10, desc: 'Zieht Büros und Hightech-Industrie an.' },
  elderly_care: { name: 'Seniorenheim', cat: 'services', size: [2, 1], cost: 6000, upkeep: 60, unlock: 2, seniorCare: 300, happy: 3, lvRadius: 6, power_use: 6, water_use: 6, desc: 'Ältere Menschen bleiben gern in der Stadt.' },
  cemetery: { name: 'Friedhof', cat: 'services', size: [2, 2], cost: 4000, upkeep: 30, unlock: 2, service: { type: 'deathcare', radius: 14, capacity: 6000 }, lv: -4, lvRadius: 4, desc: 'Ohne Bestattung wird es in der Stadt düster.' },
  crematorium: { name: 'Krematorium', cat: 'services', size: [1, 1], cost: 8000, upkeep: 70, unlock: 3, service: { type: 'deathcare', radius: 18, capacity: 12000 }, pollution: 0.4, power_use: 12, desc: 'Große Kapazität auf kleiner Fläche.' },
  sewage_plant: { name: 'Kläranlage', cat: 'water', size: [2, 2], cost: 9000, upkeep: 80, unlock: 2, sewage: 1800, needsWater: true, power_use: 14, pollution: 0.6, lv: -10, lvRadius: 5, desc: 'Reinigt Abwasser. Fließt wie Wasser durch das Straßennetz.' },
  sewage_outlet: { name: 'Abwasserauslass', cat: 'water', size: [1, 1], cost: 1200, upkeep: 8, unlock: 0, sewage: 500, needsWater: true, waterPollution: 1, lv: -14, lvRadius: 6, desc: 'Billig – leitet Abwasser ungeklärt ins Gewässer.' },
  district_heating: { name: 'Heizkraftwerk', cat: 'power', size: [2, 2], cost: 15000, upkeep: 120, unlock: 3, heat: 2400, power: 300, pollution: 1.5, water_use: 16, desc: 'Fernwärme für kalte Winter, dazu etwas Strom.' },
  prison: { name: 'Gefängnis', cat: 'services', size: [3, 2], cost: 20000, upkeep: 150, unlock: 4, crimeCity: 0.12, lv: -12, lvRadius: 6, power_use: 16, water_use: 12, desc: 'Senkt die Kriminalität in der ganzen Stadt.' },
});
