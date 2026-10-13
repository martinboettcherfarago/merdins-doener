// Zusätzliche Parks, Energie und Wahrzeichen (feste Inhalte). Schlüssel sind ein Vertrag mit den Architektur-Agenten.
import { BUILDINGS } from '../config.js';

Object.assign(BUILDINGS, {
  // Energie
  hydro: { name: 'Wasserkraftwerk', cat: 'power', size: [2, 1], cost: 18000, upkeep: 60, unlock: 3, power: 900, needsWater: true, desc: 'Sauberer, zuverlässiger Strom aus Wasserkraft. Braucht: Platz am Ufer.' },
  geothermal: { name: 'Geothermie', cat: 'power', size: [2, 2], cost: 26000, upkeep: 90, unlock: 4, power: 1600, desc: 'Sauberer Strom aus Erdwärme – Tag und Nacht.' },
  nuclear: { name: 'Kernkraftwerk', cat: 'power', size: [3, 3], cost: 70000, upkeep: 380, unlock: 5, power: 6000, water_use: 60, noise: 0.6, lv: -14, lvRadius: 8, desc: 'Riesige Mengen Strom ohne Abgase. Die Bürger sind aber skeptisch. Braucht: Wasser.' },
  battery: { name: 'Batteriespeicher', cat: 'power', size: [1, 1], cost: 6000, upkeep: 20, unlock: 3, power: 150, desc: 'Speichert Strom und fängt Engpässe ab.' },
  // Parks und Freizeit
  skatepark: { name: 'Skatepark', cat: 'parks', size: [1, 1], cost: 900, upkeep: 6, unlock: 2, park: 0.45, parkRadius: 4, noise: 0.3, desc: 'Rampen und gute Laune für Jugendliche. Etwas laut.' },
  dog_park: { name: 'Hundewiese', cat: 'parks', size: [1, 1], cost: 500, upkeep: 4, unlock: 2, park: 0.4, parkRadius: 3, desc: 'Eingezäunter Auslauf für Hunde. Macht die Nachbarn froh.' },
  pond_park: { name: 'Teichpark', cat: 'parks', size: [2, 2], cost: 3200, upkeep: 18, unlock: 3, park: 0.9, parkRadius: 7, desc: 'Park mit Teich und Steg. Macht viele Häuser ringsum glücklicher.' },
  allotment: { name: 'Kleingärten', cat: 'parks', size: [2, 2], cost: 1500, upkeep: 6, unlock: 2, park: 0.6, parkRadius: 5, desc: 'Kleingärten mit Lauben und Beeten. Macht die Nachbarn froh.' },
  swimming_pool: { name: 'Freibad', cat: 'parks', size: [2, 2], cost: 6000, upkeep: 40, unlock: 3, park: 0.8, parkRadius: 8, water_use: 12, happy: 2, lvRadius: 8, desc: 'Freibad: Im Sommer der beliebteste Ort der Stadt. Braucht: Wasser.' },
  tennis: { name: 'Tennisplätze', cat: 'parks', size: [2, 1], cost: 2400, upkeep: 12, unlock: 3, park: 0.5, parkRadius: 5, desc: 'Tennisplätze für sportliche Nachbarn.' },
  beach: { name: 'Strandbad', cat: 'parks', size: [2, 2], cost: 5000, upkeep: 24, unlock: 3, park: 0.9, parkRadius: 8, needsWater: true, tourism: 60, desc: 'Strandbad mit Sonnenschirmen. Lockt auch Touristen an. Braucht: Platz am Ufer.' },
  // Wahrzeichen
  cathedral: { name: 'Dom', cat: 'landmarks', size: [2, 3], cost: 45000, upkeep: 100, unlock: 4, unique: true, landmark: true, lv: 28, lvRadius: 12, happy: 5, tourism: 220, desc: 'Wahrzeichen: gotische Türme. Macht glücklich und lockt Touristen an.' },
  castle: { name: 'Schloss', cat: 'landmarks', size: [3, 3], cost: 60000, upkeep: 130, unlock: 4, unique: true, landmark: true, lv: 30, lvRadius: 14, happy: 6, tourism: 300, desc: 'Wahrzeichen mit Schlossgarten: viele Touristen, wertvolle Grundstücke.' },
  museum: { name: 'Museum', cat: 'landmarks', size: [2, 2], cost: 28000, upkeep: 90, unlock: 3, unique: true, landmark: true, lv: 20, lvRadius: 10, happy: 3, tourism: 150, eduCity: 0.03, desc: 'Wahrzeichen: Kunst und Geschichte. Etwas mehr Bildung in der ganzen Stadt.' },
  zoo: { name: 'Zoo', cat: 'landmarks', size: [3, 3], cost: 38000, upkeep: 140, unlock: 4, unique: true, landmark: true, lv: 15, lvRadius: 10, happy: 7, tourism: 260, desc: 'Wahrzeichen: Elefanten und Pinguine. Macht sehr glücklich.' },
  arena: { name: 'Mehrzweckhalle', cat: 'landmarks', size: [2, 2], cost: 30000, upkeep: 110, unlock: 4, unique: true, landmark: true, lv: 10, lvRadius: 10, happy: 5, tourism: 180, noise: 1, desc: 'Wahrzeichen: Konzerte und Sport. Macht glücklich, ist aber laut.' },
  botanical: { name: 'Botanischer Garten', cat: 'landmarks', size: [3, 2], cost: 22000, upkeep: 70, unlock: 3, unique: true, landmark: true, lv: 22, lvRadius: 10, happy: 4, tourism: 120, park: 1, parkRadius: 8, desc: 'Wahrzeichen: Gewächshäuser voller Tropenpflanzen. Wirkt auch wie ein Park.' },
  skytower: { name: 'Pulsturm', cat: 'landmarks', size: [2, 2], cost: 90000, upkeep: 200, unlock: 5, unique: true, landmark: true, lv: 30, lvRadius: 18, happy: 5, tourism: 350, offBoost: 30, desc: 'Wahrzeichen: der höchste Turm der Region. Zieht Büros an.' },
  citygate: { name: 'Stadttor', cat: 'landmarks', size: [2, 1], cost: 14000, upkeep: 30, unlock: 3, unique: true, landmark: true, lv: 16, lvRadius: 9, happy: 3, tourism: 100, desc: 'Wahrzeichen: ein altes Stadttor aus Backstein.' },
  windmill: { name: 'Historische Windmühle', cat: 'landmarks', size: [1, 1], cost: 8000, upkeep: 15, unlock: 2, unique: true, landmark: true, lv: 10, lvRadius: 8, happy: 2, tourism: 60, desc: 'Wahrzeichen: eine alte Windmühle, die sich noch dreht.' },
  themepark: { name: 'Freizeitpark', cat: 'landmarks', size: [4, 4], cost: 80000, upkeep: 260, unlock: 5, unique: true, landmark: true, lv: 12, lvRadius: 12, happy: 8, tourism: 500, noise: 1.2, desc: 'Wahrzeichen: Achterbahn und Wildwasserbahn. Sehr viele Touristen, aber laut.' },
  fairground: { name: 'Messegelände', cat: 'landmarks', size: [3, 3], cost: 50000, upkeep: 160, unlock: 5, unique: true, landmark: true, lv: 14, lvRadius: 10, tourism: 240, comBoost: 20, offBoost: 15, desc: 'Wahrzeichen: große Messehallen. Bringen Kundschaft für Läden und Büros.' },
});
