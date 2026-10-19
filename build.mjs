// Gera dist/monitor-pacing.html: um arquivo único, sem servidor, com JS e CSS embutidos.
// Útil para mandar por e-mail, abrir direto do disco (file://) ou publicar como página.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const r = await build({ entryPoints: ['src/ui/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/ui/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="src/ui/styles.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="src/ui/app.js"></script>', `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/monitor-pacing.html', html);
console.log(`dist/monitor-pacing.html (${(html.length / 1024).toFixed(0)} KB)`);
