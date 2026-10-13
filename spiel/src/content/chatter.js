// Zusätzlicher Stadtfunk: Bürgerstimmen zu Wetter, Verkehr, Bezirken, Industrie, Katastrophen und mehr.
// Besitzer: System-Agent „Fortschritt & Inhalte" (S5).
// Form wie in sim/progress.js: { when(g) → bool, texts: [] }. Die neuen Einträge werden VOR dem
// allgemeinen Eintrag (when: () => true) eingefügt, damit er der Rückfall bleibt.
// Stimmungsmeldungen (Wetter, Uhrzeit, Wahrzeichen) erscheinen nur gelegentlich, damit Probleme
// weiterhin Vorrang haben. Fremde Systeme werden defensiv abgefragt (g.ext.weather?.season usw.).
import { CHATTER } from '../sim/progress.js';
import { hash2 } from '../util.js';

const W = (g) => g.ext.weather || {};
const season = (g) => W(g).season;
const F = (g) => g.ext.progression?.facts || null;
const built = (g, key) => (F(g)?.byKey?.[key] || 0) > 0 || g.hasBuilt(key);
const pop = (g) => g.stats.pop;
const hour = (g) => g.hour();
let nextKey = 1;
// Deterministische Würfel pro Spielstunde (verbraucht keine Zufallszahlen der Simulation)
const sometimes = (g, p, k) => hash2(Math.floor(g.time / 60), k, ((g.opts && g.opts.seed) | 0) + 77) < p;

const ENTRIES = [];
// Statischer Eintrag
function E(when, texts, p = 1) {
  const k = nextKey++;
  ENTRIES.push({ s5: true, when: p >= 1 ? when : (g) => sometimes(g, p, k) && when(g), texts });
}
// Eintrag mit Platzhaltern: templates = [(x) => Text], ctx(g) → x (Name eines Bezirks, einer Station …)
function D(when, ctx, templates, p = 1) {
  const k = nextKey++;
  let cur = null;
  const entry = {
    s5: true, count: templates.length,
    when: (g) => {
      if (p < 1 && !sometimes(g, p, k)) return false;
      if (!when(g)) return false;
      const x = ctx(g);
      if (!x) return false;
      cur = x;
      return true;
    },
  };
  Object.defineProperty(entry, 'texts', { enumerable: true, get: () => (cur ? templates.map((t) => t(cur)) : templates.map((t) => t('der Stadt'))) });
  ENTRIES.push(entry);
}
const pickName = (g, arr, k) => (arr.length ? arr[Math.floor(hash2(Math.floor(g.time / 60), k, 3) * arr.length) % arr.length] : null);

// ---------------------------------------------------------------------------------------------
// Wetter und Jahreszeiten (Agent S4: g.ext.weather)
// ---------------------------------------------------------------------------------------------
E((g) => season(g) === 'spring', [
  'Die Kirschbäume blühen! Mein Heuschnupfen auch.',
  'Erster Kaffee draußen in diesem Jahr. Die Stadt erwacht.',
  'Frühjahrsputz auf dem Balkon. Ich habe drei Tennisbälle und einen Igel gefunden.',
  'Die Vögel singen um vier Uhr morgens. Schön. Aber um VIER.',
  'Spargelzeit! Der Bauer am Markt hat schon Schlange.',
  'Endlich wieder mit dem Rad zur Arbeit. Die Beine protestieren.',
  'Im Park sprießt alles. Nur mein Rasen nicht.',
  'Frühlingsgefühle in der Pulsbahn. Zwei Leute haben sich angelächelt!',
], 0.5);
E((g) => season(g) === 'summer', [
  'Sonnencreme, Sonnenbrille, Sonnenstich. Sommer halt.',
  'Das Freibad ist voller als die Pulsbahn zur Rushhour.',
  'Grillgeruch über der ganzen Siedlung. Ich hab Hunger.',
  'Biergarten-Wetter! Wer kommt mit?',
  'Mein Ventilator läuft seit drei Tagen ohne Pause. Er hat sich einen Namen verdient: Horst.',
  'Die Eisdiele hat jetzt Gurke-Minze. Mutig.',
  'Lange Abende auf dem Brunnenplatz – dafür lebe ich.',
  'Sommerferien. Die Straßen sind leer, die Spielplätze voll.',
], 0.5);
E((g) => season(g) === 'autumn', [
  'Das Laub raschelt so schön. Bis der Laubbläser kommt.',
  'Kürbissuppe überall. Ich beschwere mich nicht.',
  'Drachensteigen auf dem Hügel. Mein Drache steckt jetzt in einem Baum.',
  'Herbststürme zerzausen die Alleen. Sieht trotzdem toll aus.',
  'Die Kastanien fallen. Die Kinder sammeln, die Autodächer leiden.',
  'Pilzsaison! Bitte nur essen, was ihr kennt.',
  'Nebel am Morgen, goldene Sonne am Nachmittag. Herbst kann was.',
  'Die Tage werden kürzer, die Fenster leuchten früher. Gemütlich.',
], 0.5);
E((g) => season(g) === 'winter', [
  'Glühwein auf dem Weihnachtsmarkt – ich zähle nicht mit.',
  'Mein Auto ist ein Eisblock. Heute fahre ich Pulsbahn.',
  'Die Heizung bollert, die Stadt dampft. Winter!',
  'Kinder rodeln den Deich runter. Ich auch, heimlich.',
  'Um vier Uhr nachmittags ist es dunkel. Ich bin bereit für den Winterschlaf.',
  'Lebkuchen im Supermarkt seit September. Jetzt passt es endlich.',
  'Der Winterdienst war schon um fünf Uhr unterwegs. Danke, ihr Helden!',
  'Schneeballschlacht vor der Schule. Die Lehrer haben verloren.',
], 0.5);
E((g) => (W(g).rain || 0) > 0.4, [
  'Es regnet in Strömen. Ich habe meinen Schirm natürlich zu Hause gelassen.',
  'Die Pfützen am Bahnhof sind tiefer als mein Kontostand.',
  'Regen auf dem Dachfenster – perfekter Tag fürs Sofa.',
  'Schon wieder nass bis auf die Socken. Danke, Wetter.',
  'Die Gullys gurgeln. Hoffentlich hält die Kanalisation.',
  'Regenwetter = volle Cafés. Der Bäcker freut sich.',
  'Die Pulsbahn ist bei Regen doppelt so voll. Logisch, unten ist es trocken.',
]);
E((g) => (W(g).snow || 0) > 0.3, [
  'Es schneit! Die ganze Stadt sieht aus wie eine Schneekugel.',
  'Der erste Schnee! Mein Hund dreht völlig durch.',
  'Flocken so groß wie Briefmarken. Herrlich.',
  'Schneegestöber. Ich sehe die Hand vor Augen nicht – aber sie ist kalt.',
  'Die Kinder kleben an den Fensterscheiben. Schnee!',
  'Auf der Hauptstraße liegt Schnee. Die Räumfahrzeuge kommen kaum hinterher.',
]);
E((g) => (W(g).snowCover || 0) > 0.5, [
  'Überall Schneemänner. Einer trägt die Mütze des Bürgermeisters.',
  'Die Dächer sind weiß, der Himmel ist grau, mein Tee ist heiß.',
  'Matschige Gehwege. Ich rutsche mehr, als ich gehe.',
  'Schnee knirscht unter den Stiefeln. Bestes Geräusch der Welt.',
], 0.6);
E((g) => W(g).storm || (W(g).wind || 0) > 0.75, [
  'Der Sturm hat meinen Gartenstuhl zum Nachbarn geweht. Er darf ihn behalten.',
  'Es pfeift durch alle Ritzen. Fenster zu, Kerzen an.',
  'Blitz und Donner – mein Kater versteckt sich unterm Bett.',
  'Die Windräder drehen heute wie verrückt. Wenigstens die freuen sich.',
  'Mein Regenschirm hat gerade kapituliert.',
  'Sturmwarnung! Bitte bleibt drinnen und sichert eure Balkone.',
]);
E((g) => (W(g).fog || 0) > 0.5, [
  'Nebel wie in einem Krimi. Ich warte auf den Kommissar.',
  'Im Nebel sieht man nur die leuchtenden U-Bahn-Eingänge.',
  'Ich habe mich auf dem Weg zum Bäcker verlaufen. Er ist um die Ecke.',
  'Man hört die Stadt, aber man sieht sie nicht. Gespenstisch schön.',
  'Nebelhorn am Hafen, Nebelsuppe auf den Straßen.',
]);
E((g) => (W(g).temp ?? 15) > 29, [
  'Über 30 Grad. Ich wohne jetzt im Kühlschrank.',
  'Der Asphalt glüht. Meine Schuhsohlen schmelzen.',
  'Bitte denkt an die Bäume und gießt sie mit! Die haben auch Durst.',
  'Hitzefrei!!! Die beste Nachricht des Jahres.',
  'Selbst die Tauben sitzen im Schatten.',
  'In der Pulsbahn läuft die Klimaanlage. Ich fahre einfach Runden.',
]);
E((g) => (W(g).temp ?? 15) < -3, [
  'Minus zehn Grad. Mein Atem friert in der Luft.',
  'Der Stadtteich ist zugefroren. Schlittschuhe raus!',
  'Die Heizkosten frieren mir das Lächeln ein.',
  'Eiszapfen am Rathaus. Bitte nicht drunterstellen.',
  'Selbst der Pinguin im Zoo sieht zufrieden aus.',
]);
E((g) => W(g).season && (W(g).cloud ?? 1) < 0.2 && (W(g).rain || 0) < 0.1 && (W(g).temp ?? 0) >= 17 && (W(g).temp ?? 0) <= 27, [
  'Blauer Himmel, keine Wolke. Heute ist ein guter Tag.',
  'Perfektes Wetter für den Stadtpark. Picknickdecke ist dabei.',
  'Die Sonne lacht – und ich lache mit.',
  'So ein schöner Tag. Ich habe mir freigenommen.',
], 0.5);

// ---------------------------------------------------------------------------------------------
// Verkehr
// ---------------------------------------------------------------------------------------------
E((g) => pop(g) > 1000 && g.stats.trafficFlow > 0.96, [
  'Grüne Welle von der Autobahn bis ins Zentrum. Wer hat das geplant? Respekt!',
  'Kein Stau heute. Ich bin so früh im Büro, dass ich den Schlüssel noch nicht habe.',
  'Der Verkehr fließt wie Honig. Guter Honig.',
  'Zehn Minuten zur Arbeit. In der alten Stadt waren es fünfzig.',
], 0.4);
E((g) => pop(g) > 600 && g.stats.trafficFlow < 0.55, [
  'Ich stehe seit einer Stunde auf derselben Kreuzung. Ich habe hier jetzt Freunde.',
  'Stau ist, wenn man zu Fuß schneller wäre. Ich wäre zu Fuß schneller.',
  'Mein Navi hat aufgegeben und zeigt nur noch ein Fragezeichen.',
  'Die Stadt ist ein einziger Parkplatz. Bitte Alleen oder Pulsbahn!',
  'Ich habe im Stau ein Hörbuch angefangen und beendet. Teil eins von drei.',
]);
E((g) => (F(g)?.avenue || 0) > 20, [
  'Die neue Allee ist wunderschön. Platanen, breite Gehwege, Cafés.',
  'Auf der Allee flaniert man wieder. Wie früher in Paris, nur mit Döner.',
  'Alleen sind gut für den Verkehr und für die Seele.',
], 0.35);
E((g) => (F(g)?.bridges || 0) > 6, [
  'Über die Brücke zur Arbeit, mit Blick aufs Wasser. Unbezahlbar.',
  'Die Brücke wackelt nicht. Ich habe nachgemessen.',
  'Brücken verbinden. Nicht nur Ufer, auch Menschen.',
], 0.3);
E((g) => (g.ext.transport?.lines?.length || 0) > 0 || built(g, 'bus_depot'), [
  'Der Bus kam pünktlich. Ich habe es fotografiert, als Beweis.',
  'Busfahrer Kalle grüßt jeden Fahrgast mit Namen. Legende.',
  'Neue Buslinie direkt vor meiner Tür. Danke, Stadtverwaltung!',
  'Im Bus gibt es jetzt WLAN. Und einen Hund, der jeden Tag mitfährt.',
  'Bus verpasst. Der nächste kommt in drei Minuten. Fast schon zu bequem.',
]);
E((g) => built(g, 'tram_depot'), [
  'Die Straßenbahn bimmelt so schön. Nostalgie auf Schienen.',
  'Mit der Tram durch die Altstadt – das ist Lebensqualität.',
], 0.5);
E((g) => built(g, 'taxi_depot'), [
  'Mein Taxifahrer kannte jede Abkürzung und drei Geheimrezepte.',
  'Nachts um zwei ein Taxi bekommen. In dieser Stadt geht das!',
  'Der Taxifahrer hat mir die ganze Stadtgeschichte erzählt. Die Fahrt dauerte vier Minuten.',
], 0.5);
E((g) => built(g, 'parking'), [
  'Das neue Parkhaus: endlich keine Runden mehr ums Karree.',
  'Parkhausebene 4, Platz 37. Ich schreibe es mir diesmal auf.',
], 0.4);
E((g) => built(g, 'airport'), [
  'Flugzeuge über der Stadt – ich träume vom Urlaub.',
  'Vom Flughafen in 20 Minuten mit der Pulsbahn nach Hause. Weltklasse.',
  'Mein Onkel arbeitet im Tower. Er sagt, er sieht von dort mein Haus.',
  'Der Fluglärm nervt. Aber die Billigflüge nach Mallorca…',
]);
E((g) => built(g, 'train_station'), [
  'Der Hauptbahnhof ist wunderschön geworden. Gleis 1 hat sogar Blumenkästen.',
  'Fernzug pünktlich. Ich glaube, ich träume.',
  'Am Bahnhof riecht es nach Brezeln und Abenteuer.',
  'Die Pendler aus dem Umland bringen frisches Geld in die Stadt.',
], 0.6);
E((g) => built(g, 'ferry_pier'), [
  'Mit der Fähre zur Arbeit. Möwen inklusive.',
  'Die Fähre ist das schönste Verkehrsmittel der Stadt. Diskussion beendet.',
  'Auf der Fähre gibt es Kaffee mit Wellengang.',
], 0.6);

// ---------------------------------------------------------------------------------------------
// Pulsbahn
// ---------------------------------------------------------------------------------------------
E((g) => g.isUnlocked('transit') && g.transit.lines.length === 0 && pop(g) > 500, [
  'Wann kommt endlich die U-Bahn? Den Tunnel habe ich im Kopf schon gegraben.',
  'Andere Städte haben eine U-Bahn. Nur so als Hinweis.',
  'Ich habe einen Linienplan auf eine Serviette gemalt. Wer will ihn?',
  'Eine Pulsbahn vom Wohngebiet zur Fabrik – das wär’s.',
]);
E((g) => g.transit.lines.length >= 3, [
  'Drei Linien, kurze Takte – ich habe mein Auto verkauft.',
  'Umsteigen ist in dieser Stadt kein Fluch, sondern ein Erlebnis.',
  'Ich habe den Netzplan als Poster im Wohnzimmer hängen.',
  'Jede Ankunft spielt einen Ton. Heute früh klang es wie eine Symphonie.',
], 0.6);
E((g) => g.transit.lines.some((l) => l.loop), [
  'Ich bin aus Versehen dreimal im Ring gefahren. War trotzdem schön.',
  'Die Ringbahn ist mein Lieblingsort zum Nachdenken.',
  'Mit der Ringlinie einmal rund um die Stadt. Bester Ausflug für 4 Euro.',
], 0.5);
E((g) => g.policies.has('freetransit') && g.transit.lines.length > 0, [
  'Kostenlose Pulsbahn! Ich fahre jetzt aus Prinzip überallhin.',
  'Gratis Bahn fahren – das ist echte Bürgernähe.',
  'Seit die Pulsbahn nichts kostet, sehe ich meine Oma doppelt so oft.',
]);
D((g) => g.transit.stations.size > 0, (g) => pickName(g, [...g.transit.stations.values()].map((s) => s.name), 11), [
  (n) => `An der Station ${n} gibt es jetzt den besten Kaffee der Stadt.`,
  (n) => `Station ${n}: Hier hat mir jemand meinen verlorenen Schal hinterhergetragen.`,
  (n) => `Die Aussicht von der Station ${n} ist bei Sonnenuntergang unschlagbar.`,
  (n) => `Ich wohne direkt an der Station ${n}. Ich höre die Züge ankommen – wie ein Wecker mit Melodie.`,
  (n) => `Am Bahnsteig ${n} spielt jeden Freitag ein Saxophonist. Ich steige extra langsamer ein.`,
  (n) => `Neuer Treffpunkt für alle: Station ${n}, unter der großen Uhr.`,
], 0.35);
E((g) => g.transit.lines.length > 0 && (hour(g) >= 22 || hour(g) < 1), [
  'Letzte Bahn nach Hause. Die Stadt glitzert unter mir.',
  'Nachts in der Pulsbahn ist es so ruhig. Nur das Summen der Schienen.',
  'Mit der Nachtbahn heim – sicherer und schöner als jedes Taxi.',
], 0.4);
E((g) => g.transit.freeTrains > 2, [
  'Im Depot stehen nagelneue Züge rum. Warum fahren die nicht?',
  'Ich habe durch den Zaun ins Depot geschaut. Da warten Züge auf Arbeit!',
]);

// ---------------------------------------------------------------------------------------------
// Bezirke (Agent S2: g.ext.districts)
// ---------------------------------------------------------------------------------------------
D((g) => (g.ext.districts?.list?.length || 0) > 0, (g) => pickName(g, g.ext.districts.list.map((d) => d.name).filter(Boolean), 21), [
  (n) => `${n} ist das schönste Viertel der Stadt. Sag ich, und ich wohne da.`,
  (n) => `In ${n} gibt es den besten Bäcker. Ich verrate nicht, welchen.`,
  (n) => `Straßenfest in ${n}! Kommt alle, es gibt Kuchen.`,
  (n) => `${n} hat jetzt eine eigene Facebook-Gruppe. 90 % der Beiträge: Wer hat hier geparkt?`,
  (n) => `Seit ich nach ${n} gezogen bin, kenne ich alle Nachbarn beim Vornamen.`,
  (n) => `Die Mieten in ${n} steigen. Die Brötchen auch.`,
  (n) => `In ${n} wurde ein neuer Spielplatz eröffnet. Die Erwachsenen rutschen mit.`,
  (n) => `Rivalität der Viertel: ${n} gegen den Rest der Stadt beim Tauziehen. ${n} hat gewonnen.`,
], 0.4);

// ---------------------------------------------------------------------------------------------
// Industrie und Wirtschaft (Agent S1)
// ---------------------------------------------------------------------------------------------
const specCount = (g, spec) => { let n = 0; for (const b of g.buildings.values()) if (b.spec === spec && !b.abandoned) { n++; if (n > 1) break; } return n; };
E((g) => specCount(g, 'farm') > 0, [
  'Frische Milch direkt vom Hof. Die Kühe heißen Berta, Lotte und Kevin.',
  'Der Traktor vor mir fuhr 25. Ich hatte Zeit, die Felder zu bewundern.',
  'Erdbeeren selbst pflücken am Stadtrand – Kinder glücklich, Hosen rot.',
  'Es riecht nach Landwirtschaft. Man gewöhnt sich dran. Sagen sie.',
], 0.4);
E((g) => specCount(g, 'mine') > 0, [
  'Mein Opa war Bergmann, jetzt ist es mein Sohn. Glück auf!',
  'Der Förderturm ist das Wahrzeichen unseres Viertels.',
  'Erzstaub auf dem Fensterbrett. Dafür sichere Jobs.',
], 0.4);
E((g) => specCount(g, 'forest') > 0, [
  'Frisches Holz aus dem Stadtwald – mein Kamin freut sich.',
  'Die Sägewerke duften nach Harz. Schöner als jedes Parfüm.',
  'Für jeden gefällten Baum werden zwei gepflanzt. Hoffe ich.',
], 0.4);
E((g) => specCount(g, 'oil') > 0, [
  'Die Pumpenböcke nicken den ganzen Tag. Wie ältere Herren im Café.',
  'Öl im Boden, Geld in der Kasse, Gestank in der Nase.',
  'Ich arbeite auf dem Ölfeld. Meine Wäsche wird nie wieder sauber.',
], 0.4);
E((g) => ['food_factory', 'sawmill', 'steelworks', 'refinery'].some((k) => built(g, k)), [
  'Made in unserer Stadt – endlich wieder echte Produkte von hier.',
  'Die Lebensmittelfabrik backt nachts Brot. Das ganze Viertel riecht nach Frühstück.',
  'Im Stahlwerk glüht es die ganze Nacht. Romantisch, auf seine Art.',
  'Die Raffinerie leuchtet wie ein Weihnachtsbaum. Nur ohne Geschenke.',
], 0.5);
E((g) => built(g, 'cargo_harbor') || built(g, 'cargo_rail'), [
  'Containerschiffe so groß wie Hochhäuser. Ich winke trotzdem jedes Mal.',
  'Der Güterzug ist zwei Kilometer lang. Ich habe gezählt: 64 Waggons.',
  'Export läuft! Unsere Waren gehen in die ganze Welt.',
  'Am Hafen riecht es nach Diesel, Fisch und Fernweh.',
], 0.5);
E((g) => g.stats.jobsByZone[3] > 500, [
  'Die Fabriken laufen auf Hochtouren. Jobs gibt es genug.',
  'Schichtwechsel im Industriegebiet – die Würstchenbude macht Rekordumsatz.',
  'Industriekultur ist auch Kultur. Fragt die Rentner am Werkstor.',
], 0.4);
E((g) => built(g, 'warehouse'), [
  'Das Lager ist so groß, dass sich die Gabelstaplerfahrer per Funk verabreden.',
  'Im Lager arbeiten heißt: 20.000 Schritte am Tag. Bester Fitnesstarif.',
], 0.4);
E((g) => g.money < 0, [
  'Die Stadt ist pleite? Dann eben ohne neue Blumenkübel.',
  'Im Rathaus wird jetzt das Klopapier rationiert, hab ich gehört.',
  'Stadtkasse im Minus. Ich biete meine Kaffeekasse an: 3,50 €.',
  'Die Schulden der Stadt machen mir Angst. Wer bezahlt das am Ende?',
]);
E((g) => g.money > 200000, [
  'Die Stadt schwimmt im Geld. Wie wär’s mit einem Freibad mit Rutsche?',
  'Volle Kassen im Rathaus. Ich hätte da ein paar Ideen…',
  'So reich und trotzdem ein Schlagloch vor meiner Tür.',
  'Sparen ist gut, investieren ist besser. Nur so als Tipp.',
], 0.6);
E((g) => g.loans.length > 0, [
  'Die Stadt hat einen Kredit aufgenommen. Hoffentlich nicht beim Kredithai.',
  'Kredite sind okay, solange daraus was Schönes wird.',
  'Mein Bankberater sagt, die Stadt ist ein guter Schuldner. Na dann.',
], 0.4);
E((g) => (g.stats.tourism || 0) > 300, [
  'Überall Touristen mit Stadtplänen. Ich fühle mich wie in einer Großstadt.',
  'Die Souvenirläden verkaufen jetzt Pulsbahn-Schneekugeln. Ich habe drei.',
  'Ein Tourist hat mich nach dem Weg gefragt. Ich habe ihn persönlich hingebracht.',
  'Reisebusse am Marktplatz. Die Eisdiele hat einen zweiten Laden aufgemacht.',
  'Unsere Stadt im Reiseführer! Seite 47, mit Foto.',
], 0.6);
E((g) => pop(g) > 800 && g.stats.unemployment < 0.03, [
  'Fachkräftemangel: Mein Chef hat mir eine Gehaltserhöhung angeboten, bevor ich fragen konnte.',
  'Jeder hat hier Arbeit. Selbst mein Schwager.',
  'Überall Stellenanzeigen. Die Bäckerei sucht sogar einen Brezel-Sommelier.',
]);
E((g) => g.demand[2] > 50, [
  'Die Leute wollen shoppen, aber es gibt kaum Läden.',
  'Für einen neuen Pullover muss ich in die Nachbarstadt. Peinlich.',
]);
E((g) => g.demand[1] > 60 && pop(g) > 200, [
  'Ich suche seit Wochen eine Wohnung. Die Besichtigung war voller als ein Rockkonzert.',
  'Wohnungen sind Mangelware. Ich wohne vorübergehend im Bauwagen meines Cousins.',
]);

// ---------------------------------------------------------------------------------------------
// Dienste und Versorgung
// ---------------------------------------------------------------------------------------------
E((g) => built(g, 'hospital'), [
  'Im Krankenhaus wurde ich super behandelt. Das Essen… reden wir nicht drüber.',
  'Der Rettungshubschrauber landet gerade. Hoffentlich nichts Schlimmes.',
  'Mein Baby wurde im neuen Krankenhaus geboren. Danke an die Hebammen!',
], 0.5);
E((g) => built(g, 'university'), [
  'Die Uni bringt Leben in die Stadt. Und Pizzalieferdienste.',
  'Erstsemesterparty im Park. Ich bin 54 und war trotzdem da.',
  'Meine Tochter studiert jetzt hier statt in der Großstadt. Ich bin so froh.',
  'Die Bibliothek der Uni hat bis Mitternacht geöffnet. Ich wohne quasi dort.',
], 0.5);
E((g) => built(g, 'school') || built(g, 'kindergarten'), [
  'Elternabend in der Schule. Drei Stunden über Kekse diskutiert.',
  'Die neue Kita hat einen Garten mit Hühnern. Die Kinder lieben es.',
  'Schulhof-Flohmarkt am Samstag! Ich verkaufe meine alten Comics.',
], 0.35);
E((g) => built(g, 'library'), [
  'In der Bibliothek ist es so still, dass ich mein Herz schlagen höre.',
  'Ich habe ein Buch zurückgegeben, das 12 Jahre überfällig war. Sie haben mir verziehen.',
], 0.4);
E((g) => built(g, 'policehq') || (pop(g) > 2000 && g.stats.crimeAvg < 0.1), [
  'Ich lasse mein Fahrrad wieder unabgeschlossen stehen. Fast.',
  'Die Polizei hat mir meinen Geldbeutel zurückgebracht. Mit allem drin!',
  'Sichere Stadt, ruhige Nächte. So soll es sein.',
], 0.4);
E((g) => g.countBuilt('services') > 2 && g.stats.burning === 0, [
  'Tag der offenen Tür bei der Feuerwehr. Mein Sohn will jetzt Feuerwehrmann werden.',
  'Die Feuerwehr hat die Katze vom Baum geholt. Wieder mal.',
], 0.3);
E((g) => built(g, 'recycling') || g.policies.has('recycling'), [
  'Mülltrennung ist mein neues Hobby. Ich habe sieben Tonnen auf dem Balkon.',
  'Aus Joghurtbechern werden Parkbänke. Wie cool ist das denn?',
  'Der Recyclinghof hat samstags offen. Mein Lieblingstermin der Woche.',
], 0.4);
E((g) => built(g, 'incinerator'), [
  'Die Müllverbrennung macht Strom aus meinem Abfall. Ich esse jetzt mehr Pizza – für die Energie.',
  'Aus dem Schornstein der Müllverbrennung kommt nur Dampf. Sagen sie.',
], 0.4);
E((g) => built(g, 'cemetery') || built(g, 'crematorium'), [
  'Der Friedhof ist so ruhig und grün – ich gehe dort gern spazieren.',
  'Opa hätte den neuen Friedhof gemocht. Mit Blick aufs Wasser.',
  'Auf dem Friedhof blühen die Rosen. Das Leben geht weiter.',
], 0.3);
E((g) => (g.cov?.deathcare && pop(g) > 1500 && !built(g, 'cemetery') && !built(g, 'crematorium')), [
  'Wohin mit den Verstorbenen? Die Stadt braucht einen Friedhof.',
  'Der Leichenwagen musste bis in die Nachbarstadt fahren. Unwürdig.',
]);
E((g) => built(g, 'sewage_outlet') && !built(g, 'sewage_plant'), [
  'Am Fluss stinkt es. Wohin leiten die bitte das Abwasser?',
  'Baden im See? Nach dem Abwasserauslass lieber nicht.',
  'Die Enten sehen auch schon ganz unglücklich aus.',
]);
E((g) => built(g, 'sewage_plant'), [
  'Die Kläranlage macht das Wasser sauber. Die Fische sind zurück!',
  'Führung durch die Kläranlage: Riecht, ist aber faszinierend.',
], 0.4);
E((g) => built(g, 'elderly_care'), [
  'Oma ist ins Seniorenheim gezogen. Sie hat dort jetzt mehr Termine als ich.',
  'Bingo-Abend im Seniorenheim. Die Stimmung war besser als in jedem Club.',
], 0.4);
E((g) => built(g, 'prison'), [
  'Das Gefängnis am Stadtrand macht mir ein bisschen Angst.',
  'Seit das Gefängnis steht, sind die Einbrüche zurückgegangen. Sagt die Statistik.',
  'Die Insassen backen Brot für die Tafel. Schmeckt gut!',
], 0.4);
E((g) => built(g, 'nuclear'), [
  'Das Kernkraftwerk liefert viel Strom. Ich schlafe trotzdem mit einem Geigerzähler.',
  'Meine Nachbarin leuchtet nicht im Dunkeln. Ich habe nachgesehen.',
  'Atomkraft? Gemischte Gefühle beim Abendessen.',
], 0.5);
E((g) => built(g, 'wind') && (F(g)?.byKey?.wind || 0) >= 3, [
  'Die Windräder drehen sich so meditativ. Ich zähle sie zum Einschlafen.',
  'Saubere Energie aus der Luft. Ich bin stolz auf unsere Stadt.',
  'Ein Windrad hat meinem Drachen den Wind geklaut. Das ist mein Ernst.',
], 0.4);
E((g) => built(g, 'solar'), [
  'Die Solarparks glänzen in der Sonne. Ich trage dort eine Sonnenbrille.',
  'Strom von der Sonne – und nachts? Die Batteriespeicher regeln das.',
], 0.4);
E((g) => built(g, 'coal') && pop(g) > 1500, [
  'Der Kohlekraftwerksschornstein grüßt jeden Morgen mit einer schwarzen Wolke.',
  'Kohle ist billig, aber mein Balkon ist grau.',
  'Wann steigen wir endlich auf saubere Energie um?',
], 0.4);
E((g) => built(g, 'fusion'), [
  'Wir haben einen Fusionsreaktor. In UNSERER Stadt. Science-Fiction ist jetzt.',
  'Sternenfeuer im Käfig. Mein Physiklehrer wäre so stolz.',
], 0.5);
E((g) => built(g, 'geothermal'), ['Wärme aus der Tiefe – unsere Stadt hat einen warmen Bauch.'], 0.4);
E((g) => built(g, 'pump') || built(g, 'waterworks'), [
  'Unser Leitungswasser ist besser als jedes Flaschenwasser.',
  'Das Wasserwerk hat Tag der offenen Tür. Gratis Wasser! Na ja.',
], 0.3);

// ---------------------------------------------------------------------------------------------
// Katastrophen (Agent S4: emit('disaster', …) – Nachklang drei Tage)
// ---------------------------------------------------------------------------------------------
const recent = (g) => { const d = g.ext.progression?.lastDisaster; return d && g.day() - d.day <= 3 ? d : null; };
const dType = (g, ...types) => { const d = recent(g); return !!d && types.some((t) => String(d.type || '').toLowerCase().includes(t)); };
E((g) => !!recent(g), [
  'Was für ein Schreck. Aber wir halten zusammen.',
  'Danke an alle Helferinnen und Helfer! Ihr seid die Besten.',
  'Die Nachbarn haben mir beim Aufräumen geholfen. So ist unsere Stadt.',
  'Spendenaktion im Gemeindehaus. Jeder Euro hilft.',
  'Der Wiederaufbau hat begonnen. Die Bauarbeiter singen beim Arbeiten.',
]);
E((g) => dType(g, 'flood', 'hochwasser', 'flut'), [
  'Mein Keller ist ein Aquarium. Jetzt fehlen nur noch Fische.',
  'Sandsäcke schleppen bis Mitternacht. Morgen tun mir alle Muskeln weh.',
  'Das Wasser geht zurück. Der Schlamm bleibt.',
]);
E((g) => dType(g, 'storm', 'sturm', 'tornado'), [
  'Der Tornado hat das Dach vom Gartenhaus geholt. Den Gartenzwerg nicht – der ist zäh.',
  'Bäume liegen kreuz und quer. Die Kettensägen laufen den ganzen Tag.',
  'So einen Sturm habe ich in 80 Jahren nicht erlebt, sagt meine Oma.',
]);
E((g) => dType(g, 'quake', 'erdbeben'), [
  'Die Gläser im Schrank haben geklirrt. Dann der ganze Schrank.',
  'Erdbeben! Ich dachte erst, es ist die Waschmaschine im Schleudergang.',
  'Risse in der Hauswand. Der Statiker kommt morgen.',
]);
E((g) => dType(g, 'fire', 'brand', 'wildfire'), [
  'Der Himmel war ganz orange vom Rauch. Gruselig.',
  'Die Feuerwehr hat die ganze Nacht gekämpft. Helden!',
]);
E((g) => dType(g, 'meteor'), [
  'Ein Meteorit! Mein Sohn will ein Stück davon für die Schule.',
  'Ich habe den Einschlag gesehen. Erst ein Licht, dann ein Knall, dann Stille.',
]);
E((g) => dType(g, 'lightning', 'blitz'), [
  'Der Blitz ist direkt neben dem Kirchturm eingeschlagen. Ich bin fast vom Rad gefallen.',
  'Stromausfall nach dem Blitzschlag. Zum Glück war der Kuchen schon fertig.',
]);
E((g) => g.stats.burning > 2, [
  'Mehrere Feuer gleichzeitig! Die Sirenen heulen in der ganzen Stadt.',
  'Rauchwolken über den Dächern. Bitte Fenster schließen!',
]);

// ---------------------------------------------------------------------------------------------
// Wahrzeichen
// ---------------------------------------------------------------------------------------------
const LM = {
  ferris: ['Vom Riesenrad aus sieht man bis zur Autobahn. Und meinen Ex.', 'Riesenrad bei Nacht – die ganze Stadt funkelt.'],
  tvtower: ['Der Fernsehturm ist mein Kompass. Man verläuft sich nie.', 'Im Drehrestaurant des Fernsehturms war der Kuchen schneller rum als die Aussicht.'],
  stadium: ['Heimspiel! Die ganze Stadt ist in Vereinsfarben.', 'Nach dem Tor hat das Stadion so gebebt, dass mein Bier überschwappte.'],
  opera: ['Gestern in der Oper geweint. Schön geweint.', 'Ein Opernhaus in unserer Stadt – Kultur auf Weltniveau.'],
  observatory: ['Durchs Teleskop der Sternwarte habe ich die Ringe des Saturn gesehen. Wow.', 'Sternwarten-Nacht für Kinder: Alle wollen jetzt Astronaut werden.'],
  doener: ['Chili-Cheese-Döner um Mitternacht. Das Leben ist schön.', 'Bei Mêrdîn dreht sich der Spieß auf dem Dach. Und mein Magen vor Freude.'],
  lighthouse: ['Der Leuchtturm blinkt mir jede Nacht gute Nacht.', 'Heiratsantrag auf dem Leuchtturm. Sie hat Ja gesagt!'],
  cathedral: ['Die Glocken des Doms läuten zum Sonntag. Gänsehaut.', 'Im Dom ist es im Sommer angenehm kühl. Und im Winter eiskalt.'],
  castle: ['Hochzeit im Schlossgarten – wie im Märchen.', 'Im Schloss spukt es angeblich. Ich habe nur einen Hausmeister gesehen.'],
  museum: ['Im Museum stehen jetzt Dinosaurier! Na ja, Knochen davon.', 'Museumsnacht: Ich habe ein Bild entdeckt, das aussieht wie meine Tante.'],
  zoo: ['Die Pinguine im Zoo watscheln genau wie mein Chef.', 'Im Zoo hat mir ein Lama ins Gesicht gespuckt. Ich liebe es trotzdem.'],
  arena: ['Konzert in der Halle: Ich kann seit gestern nichts mehr hören. Es war fantastisch.', 'Basketball-Derby in der Mehrzweckhalle – ausverkauft!'],
  botanical: ['Im Gewächshaus blüht die Riesenblume. Sie riecht furchtbar – alle wollen hin.', 'Botanischer Garten im Winter: Tropen zum Eintrittspreis.'],
  skytower: ['Vom Pulsturm sieht man drei Bundesländer. Gefühlt.', 'Fahrstuhl in den Pulsturm: Meine Ohren knacken immer noch.'],
  citygate: ['Durchs Stadttor zu schreiten fühlt sich an wie im Mittelalter. Mit Handy.', 'Das alte Stadttor ist das beliebteste Fotomotiv der Touristen.'],
  windmill: ['Die alte Windmühle mahlt wieder Mehl. Das Brot daraus ist ein Traum.', 'An der Windmühle picknicken – Postkartenidylle.'],
  themepark: ['Achterbahn fünfmal hintereinander. Mein Magen spricht nicht mehr mit mir.', 'Im Freizeitpark gibt es jetzt eine Pulsbahn-Achterbahn. Wie passend.'],
  fairground: ['Auf der Messe wird die Zukunft vorgestellt. Und Staubsauger.', 'Messewoche: Alle Hotels voll, die Taxis auch.'],
};
for (const [key, texts] of Object.entries(LM)) E((g) => built(g, key), texts, 0.3);

// ---------------------------------------------------------------------------------------------
// Uhrzeit, Wochentag, Stadtgröße, Stimmung
// ---------------------------------------------------------------------------------------------
E((g) => hour(g) >= 5 && hour(g) < 7, [
  'Fünf Uhr morgens, die Bäckerei hat schon offen. Die wahren Helden der Stadt.',
  'Morgens um sechs ist die Stadt noch ganz still. Nur die Müllabfuhr singt.',
  'Erster Zug des Tages. Ich bin allein im Waggon – Luxus.',
], 0.4);
E((g) => hour(g) >= 0 && hour(g) < 4, [
  'Kann nicht schlafen. Die Stadt leuchtet so schön.',
  'Nachtschicht im Krankenhaus. Kaffee Nummer vier.',
  'Um drei Uhr nachts Döner holen – ein Grundrecht.',
  'Die Straßenlaternen summen. Die Katzen sind unterwegs.',
], 0.4);
E((g) => pop(g) > 500 && ((hour(g) >= 7 && hour(g) < 9) || (hour(g) >= 16.5 && hour(g) < 18.5)), [
  'Rushhour! Alle wollen gleichzeitig irgendwohin.',
  'Feierabend! Die Biergärten füllen sich.',
  'Morgens im Gedränge, abends im Gedränge. Dazwischen Arbeit.',
], 0.35);
E((g) => g.weekday() >= 5, [
  'Wochenende! Flohmarkt, Fußball und Faulenzen.',
  'Samstagmorgen auf dem Markt – frisches Obst und Tratsch.',
  'Sonntagsspaziergang durch den Park. Halb die Stadt ist unterwegs.',
  'Am Wochenende schlafe ich bis zehn. Mein Nachbar bohrt ab acht.',
], 0.4);
E((g) => g.weekday() === 0, [
  'Montag. Der Kaffee wirkt nicht.',
  'Neue Woche, neue Chancen. Und neue Wochenkarten im Rathaus, hört man.',
], 0.35);
E((g) => pop(g) > 20 && pop(g) < 300, [
  'Hier kennt jeder jeden. Auch die Hühner.',
  'Unser Dorf hat jetzt einen eigenen Kiosk. Wir sind praktisch eine Großstadt.',
  'Der Bürgermeister hat mir persönlich die Hand geschüttelt. Bei 200 Einwohnern geht das noch.',
  'Abends ist es so still, dass man die Frösche hört.',
], 0.5);
E((g) => pop(g) >= 1500 && pop(g) < 5000, [
  'Wir sind jetzt offiziell eine Stadt! Mit Ampeln und allem.',
  'Erst ein Dorf, jetzt eine Stadt. Ich habe alles miterlebt.',
  'Die Stadt wächst so schnell, dass mein Stadtplan schon wieder alt ist.',
], 0.4);
E((g) => pop(g) >= 10000, [
  'Großstadt! Man kann jetzt anonym einkaufen gehen.',
  'Die Skyline sieht aus wie im Film.',
  'Zehntausende Menschen, und trotzdem habe ich heute meine Grundschullehrerin getroffen.',
  'Wohin man schaut: Kräne. Die Stadt hört nicht auf zu wachsen.',
], 0.5);
E((g) => g.stats.happiness > 80 && pop(g) > 300, [
  'Ich wüsste nicht, wo ich lieber wohnen würde.',
  'Selbst der Briefträger pfeift hier.',
  'Diese Stadt ist ein Zuhause, nicht nur ein Wohnort.',
], 0.5);
E((g) => g.stats.happiness < 35 && pop(g) > 300, [
  'Ich schreibe jetzt jeden Tag einen Beschwerdebrief. Das Rathaus kennt meine Handschrift.',
  'Wenn das so weitergeht, ziehe ich zu meiner Schwester aufs Land.',
  'Die Laune in der Stadt ist im Keller. Und der Keller steht unter Wasser.',
]);
E((g) => g.stats.abandoned > 3, [
  'In meiner Straße stehen drei Häuser leer. Gruselig nachts.',
  'Leere Fenster, verwilderte Gärten. Was ist hier passiert?',
  'Das verlassene Haus an der Ecke wird von Tauben übernommen.',
]);
E((g) => (F(g)?.construct || 0) > 6, [
  'Überall Baustellen. Die Stadt wächst – und mein Wecker heißt jetzt Presslufthammer.',
  'Ich beobachte die Bauarbeiten jeden Tag in der Mittagspause. Bester Film der Stadt.',
  'Ein Kran neben meinem Fenster. Der Kranführer winkt mir morgens zu.',
  'Neue Häuser, neue Nachbarn, neues Leben.',
], 0.5);
E((g) => (F(g)?.parks || 0) > 10, [
  'So viele Parks! Ich mache jeden Tag ein anderes Picknick.',
  'Die Stadt ist grün wie ein Wald mit Häusern drin.',
  'Im Park gibt es jetzt Yoga am Morgen. Und Tai-Chi am Abend.',
], 0.4);
E((g) => pop(g) > 3000 && g.stats.pollutionAvg < 0.03, [
  'Die Luft ist so sauber, dass mein Asthma Urlaub macht.',
  'Eine große Stadt mit frischer Luft – geht doch!',
], 0.5);

// ---------------------------------------------------------------------------------------------
// Szenarien und Metro-Modus (dieser Agent)
// ---------------------------------------------------------------------------------------------
const scenName = (g) => { const s = g.ext.progression?.scen; return s && s.status === 'running' && s.id !== 'metro' ? g.name : null; };
D((g) => !!scenName(g), scenName, [
  (n) => `Die ganze Region schaut auf ${n}. Schaffen wir das?`,
  (n) => `In ${n} spürt man Aufbruchstimmung. Jetzt oder nie!`,
  (n) => `Die Zeitung zählt die Tage herunter. ${n} gibt alles.`,
  (n) => `Meine Oma sagt, ${n} war schon immer eine Kämpferstadt.`,
], 0.3);
E((g) => g.opts?.scenario === 'metro' && (g.ext.progression?.metro?.worst || 0) > 0.5, [
  'Der Bahnsteig ist so voll, ich stehe auf einem Bein.',
  'Noch ein Fahrgast mehr und die Station platzt!',
  'Wo bleibt der Zug?! Ich warte seit Ewigkeiten.',
]);
E((g) => g.opts?.scenario === 'metro', [
  'Schon wieder ein neues Viertel! Die Stadt wächst wie Pilze nach dem Regen.',
  'Ich fahre jeden Tag mit der Pulsbahn. Etwas anderes gibt es hier ja nicht.',
  'Mein Arbeitsweg: zwei Linien, ein Umstieg, null Stress.',
  'Der Netzplan wird jede Woche bunter.',
], 0.6);

// ---------------------------------------------------------------------------------------------
// Allgemeiner Humor – landet im Rückfall-Eintrag (when: () => true)
// ---------------------------------------------------------------------------------------------
const GENERIC = [
  'Ich habe heute einen Parkplatz direkt vor der Tür gefunden. Ich erzähle es allen.',
  'Mein Nachbar mäht seinen Rasen mit der Nagelschere. Jeden Halm einzeln.',
  'Im Supermarkt gab es Streit um die letzte Packung Hefe. Wir backen alle Brot jetzt.',
  'Taube auf dem Rathausdach beobachtet mich. Ich beobachte zurück.',
  'Neuer Rekord: Ich habe den Bus zum fünften Mal in Folge knapp verpasst.',
  'Wer hat den Gartenzwerg mit der Sonnenbrille vor dem Rathaus aufgestellt? Ich will ihn auch.',
  'Heute im Café ein Gespräch belauscht: Es ging um Kanaldeckel. Leidenschaftlich.',
  'Meine Katze hat sich auf das WLAN-Kabel gelegt. Internet weg. Katze glücklich.',
  'Der Eiswagen spielt seine Melodie. Ich bin 42 und renne trotzdem los.',
  'Habe beim Joggen meinen Chef überholt. Morgen kündige ich nicht.',
  'Jemand hat einen Strickpulli um die Laterne in der Lindenstraße gestrickt. Kunst!',
  'Ich habe mich mit meinem Nachbarn über den Zaun versöhnt. Jetzt streiten wir über die Hecke.',
  'Mein Sohn fragt, ob man Pulsbahn-Fahrer werden kann. Ich sage: Man kann alles werden.',
  'Auf dem Wochenmarkt gibt es jetzt Kohlrabi-Eis. Ich habe es probiert. Einmal reicht.',
  'Der Brunnen auf dem Marktplatz hat heute Schaum. Irgendwer hat Spülmittel reingekippt.',
  'Wieder ein Sonnenaufgang über der Stadt. Ich mache jedes Mal ein Foto. 4.000 bisher.',
  'Ich glaube, die Enten im Park erkennen mich. Ich bringe immer Haferflocken mit.',
  'Mein Fahrrad ist so alt, dass es unter Denkmalschutz steht.',
  'Im Treppenhaus riecht es nach Zimtschnecken. Ich vermute Frau Krause aus dem Dritten.',
  'Heute ist Kehrwoche. Ich habe sie vergessen. Ich habe Angst.',
  'Bei uns im Haus gibt es jetzt eine Bücherkiste. Ich habe drei Krimis mitgenommen und einen Kochkalender dagelassen.',
  'Die Grundschule hat ein Theaterstück aufgeführt: „Der Bürgermeister und die Schlaglöcher". Sehr realistisch.',
  'Ich habe den Stadtfunk abonniert. Jetzt weiß ich mehr über meine Nachbarn als über mich selbst.',
  'Der Hund von nebenan hat gelernt, die Klingel zu drücken. Er will nur Leckerlis.',
  'Ich war heute im Rathaus und habe eine Nummer gezogen. Es war Nummer 1. Ich war allein. Herrlich.',
  'Unsere Stadt hat jetzt einen eigenen Song. Er reimt „Pulsbahn" auf „Turnschuh-Wahn".',
  'Ich habe einen Igel im Garten. Er heißt Herbert und ist sehr beschäftigt.',
  'Die Kirchturmuhr geht fünf Minuten nach. Die ganze Stadt richtet sich danach.',
  'Mein Navi sagt: „Sie haben Ihr Ziel erreicht." Ich stehe vor dem Döner. Das Navi kennt mich.',
  'Heute war ein guter Tag. Einfach so. Das sollte man auch mal sagen.',
];

// --- Einfügen: vor dem allgemeinen Eintrag, damit er der Rückfall bleibt
let fallbackIdx = -1;
for (let i = CHATTER.length - 1; i >= 0; i--) {
  try { if (CHATTER[i].when.length === 0 && CHATTER[i].when()) { fallbackIdx = i; break; } } catch (e) { /* weiter */ }
}
if (fallbackIdx >= 0) {
  CHATTER.splice(fallbackIdx, 0, ...ENTRIES);
  CHATTER[fallbackIdx + ENTRIES.length].texts.push(...GENERIC);
} else {
  CHATTER.push(...ENTRIES, { when: () => true, texts: GENERIC });
}

// Für den Prüfstand: Anzahl neuer Meldungen
export const S5_CHATTER_COUNT = ENTRIES.reduce((a, e) => a + (e.count || e.texts.length), 0) + GENERIC.length;
export const S5_CHATTER_ENTRIES = ENTRIES;
