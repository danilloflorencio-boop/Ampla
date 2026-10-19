// Gera src/demo/planoDemo.js a partir da fixture (plano SEBRAE REV3 já parseado).
// Uso: node tools/gerar_demo.mjs
import { writeFileSync } from 'node:fs';
import { lerXlsx } from '../tests/_ler_xlsx.js';
import { lerPlano } from '../src/core/plano.js';
const arq = 'SEBRAE - EMPRETEC + LIDERE · Plano de Mídia (novo formato) · Outubro 2026_REV3.xlsx';
const plano = lerPlano(lerXlsx(new URL('../fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx', import.meta.url).pathname), { arquivo: arq, importadoEm: '2026-10-19T09:00:00.000Z' });
writeFileSync(new URL('../src/demo/planoDemo.js', import.meta.url),
  `// Gerado por tools/gerar_demo.mjs — plano SEBRAE PE REV3 já lido pelo importador (não editar à mão).\nexport default ${JSON.stringify(plano)};\n`);
console.log('planoDemo.js:', plano.linhas.length, 'linhas');
