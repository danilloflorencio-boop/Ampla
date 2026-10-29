// Gera arquivos únicos em dist/, sem servidor, com JS e CSS embutidos:
//   dist/monitor-pacing.html  o monitor
//   dist/teste-painel.html    a página de teste do painel (dados fictícios)
// Úteis para mandar por e-mail, abrir direto do disco (file://) ou publicar como página.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const PAGINAS = [
  { html: 'index.html', js: 'src/ui/app.js', saida: 'dist/monitor-pacing.html' },
  { html: 'teste-painel.html', js: 'src/ui/teste.js', saida: 'dist/teste-painel.html' },
];
const css = readFileSync('src/ui/styles.css', 'utf8');
mkdirSync('dist', { recursive: true });
for (const p of PAGINAS) {
  const r = await build({ entryPoints: [p.js], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = readFileSync(p.html, 'utf8')
    // função como substituto: o JS minificado tem sequências como $' e $& que o replace interpretaria
    .replace('<link rel="stylesheet" href="src/ui/styles.css">', () => `<style>${css}</style>`)
    .replace(`<script type="module" src="${p.js}"></script>`, () => `<script>${js}</script>`);
  writeFileSync(p.saida, html);
  console.log(`${p.saida} (${(html.length / 1024).toFixed(0)} KB)`);
}
