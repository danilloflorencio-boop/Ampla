// Gera os avisos de pacing do dia a partir de um workspace exportado do monitor
// ("Exportar workspace completo", em Equipe e avisos). Saída: JSON na saída padrão, pronto
// para o Operações Bot entregar no Google Chat. Não envia nada sozinho.
// Uso: node tools/avisos.mjs workspace.json [--ref AAAA-MM-DD] [--link https://…]
import { readFileSync } from 'node:fs';
import { hojeSP } from '../src/core/format.js';
import { montarPainel } from '../src/core/painel.js';
import { montarAvisos } from '../src/core/avisos.js';
import { configDoCliente } from '../src/config/config.js';

const args = process.argv.slice(2);
const opcao = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };
const arquivo = args.find((a, i) => !a.startsWith('--') && !['--ref', '--link'].includes(args[i - 1]));
if (!arquivo) {
  console.error('Uso: node tools/avisos.mjs workspace.json [--ref AAAA-MM-DD] [--link https://…]');
  process.exit(1);
}
const db = JSON.parse(readFileSync(arquivo, 'utf8'));
const ref = opcao('--ref') || hojeSP();
const cfg = configDoCliente({ avisos: { linkPainel: opcao('--link') ?? db.preferencias?.linkPainel ?? '' } });
const painel = montarPainel(Object.values(db.clientes || {}), ref);
const { avisos, semResponsavel, desatualizadas } = montarAvisos(painel.contas, db.equipe, ref, cfg);
console.log(JSON.stringify({
  ref,
  avisos: avisos.map(({ para, nome, papel, texto }) => ({ para, nome, papel, texto })),
  semResponsavel: semResponsavel.map((c) => c.id),
  desatualizadas: desatualizadas.map((c) => c.id),
}, null, 2));
