// Baut dist/stadtpuls.js aus src/ (esbuild). Optional: --artifact <datei> erzeugt eine eigenständige Einzelseite.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const artIdx = args.indexOf('--artifact');

// Eingebaute Vorzeigestadt (saves/megastadt.json): nur die Eckdaten für den Eintrag im Menü, der Stand selbst wird
// erst beim Laden geholt
let mega = null;
try {
  const d = JSON.parse(readFileSync(join(here, 'saves/megastadt.json'), 'utf8'));
  mega = { name: d.name || 'Megastadt', pop: d.pop || 0, day: Math.floor((d.time || 0) / 1440) + 1 };
} catch (e) { console.warn('saves/megastadt.json fehlt – kein Megastadt-Eintrag im Menü'); }

const opts = {
  entryPoints: [join(here, 'src/main.js')],
  define: { __MEGASTADT__: JSON.stringify(mega) },
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: !watch,
  sourcemap: false,
  outfile: join(here, 'dist/stadtpuls.js'),
  legalComments: 'eof',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
} else {
  await esbuild.build(opts);
  if (artIdx >= 0) {
    // Für die Einzelseite wird Three.js nicht eingebettet, sondern als UMD-Build vom CDN geladen.
    const threeGlobal = {
      name: 'three-global',
      setup(b) {
        b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'three-global' }));
        b.onLoad({ filter: /.*/, namespace: 'three-global' }, () => ({ contents: 'module.exports = globalThis.THREE;', loader: 'js' }));
      },
    };
    const res = await esbuild.build({ ...opts, outfile: undefined, write: false, plugins: [threeGlobal] });
    const out = args[artIdx + 1];
    const html = readFileSync(join(here, 'index.html'), 'utf8');
    const css = readFileSync(join(here, 'style.css'), 'utf8');
    const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
    // Schriften liegen lokal unter fonts/ (style.css) – ein Google-Fonts-Link ist optional
    const fonts = (html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/) || [''])[0];
    const body = html.split('<body>')[1].split('</body>')[0].replace(/<script src="dist\/stadtpuls\.js"><\/script>/, '');
    // Die Megastadt reist in der Einzelseite mit (kein Nachladen nötig); „</" wird für das Script-Tag maskiert
    let megaTag = '';
    try { megaTag = `<script type="application/json" id="stadtpuls-megastadt">${readFileSync(join(here, 'saves/megastadt.json'), 'utf8').replace(/<\//g, '<\\/')}</script>\n`; } catch (e) { /* ohne Megastadt */ }
    const page = `<title>Cityscapes</title>\n<meta name="description" content="3D-Städtebau- und Verkehrsspiel im Browser.">\n${fonts}\n<style>\n${css}\n</style>\n${body.trim()}\n${megaTag}<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>\n<script>window.STADTPULS_EMBED = true;</script>\n<script>\n${js}\n</script>\n`;
    writeFileSync(out, page);
    console.log('Artifact-Seite geschrieben:', out, (page.length / 1024).toFixed(0), 'KB');
  }
}
