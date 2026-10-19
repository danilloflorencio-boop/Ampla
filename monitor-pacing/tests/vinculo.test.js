import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alocarRealizado, sugerirVinculos } from '../src/core/vinculo.js';
import { chaveEntidade, entidadesDoRealizado } from '../src/core/realizado.js';

const L = (id, inicio, fim, diariaPlan, extra = {}) => ({
  id, inicio, fim, diariaPlan, plataforma: 'META ADS', produto: 'EMPRETEC', praca: 'RECIFE',
  codigosTurma: ['EV-84164'], tipoCodigo: 'turma', ...extra,
});
const reg = (data, gasto, conjuntoNome = 'EV-84164_RECIFE_30A') => ({
  data, plataforma: 'META ADS', contaId: 'a', campanhaId: 'c', campanhaNome: 'SEBRAEPE_EMPRETEC_LEADS_2026',
  conjuntoId: conjuntoNome, conjuntoNome, gasto, impressoes: 100, cliques: 10, cliquesLink: 5, leads: 1,
  conversoes: 1, engajamentos: 0, visualizacoes: null, orcamentoDiario: null,
});

test('mesmo conjunto em flights sobrepostos: rateio pela diária planejada', () => {
  const out = L('out', '2026-10-01', '2026-10-19', 13491);
  const acr = L('acr', '2026-10-13', '2026-10-23', 9779);
  const r = reg('2026-10-14', 23270);
  const v = { [chaveEntidade(r)]: { linhas: ['out', 'acr'] } };
  const { alocacoes } = alocarRealizado([r], [out, acr], v, '2026-10-19');
  const g = Object.fromEntries(alocacoes.map((a) => [a.linhaId, a.gasto]));
  assert.equal(g.out, Math.round(23270 * 13491 / (13491 + 9779)));
  assert.equal(g.out + g.acr, 23270);
});

test('peso manual sobrepõe a diária', () => {
  const a = L('a', '2026-10-01', '2026-10-10', 100), b = L('b', '2026-10-01', '2026-10-10', 100);
  const r = reg('2026-10-02', 1000);
  const { alocacoes } = alocarRealizado([r], [a, b], { [chaveEntidade(r)]: { linhas: ['a', 'b'], pesos: { a: 3, b: 1 } } }, '2026-10-05');
  assert.deepEqual(alocacoes.map((x) => x.gasto), [750, 250]);
});

test('órfão, fora do período e parcial de hoje', () => {
  const a = L('a', '2026-10-01', '2026-10-05', 100);
  const ok = reg('2026-10-02', 1000), fora = reg('2026-10-07', 500), hoje = reg('2026-10-08', 300), orf = reg('2026-10-02', 200, 'OUTRO');
  const v = { [chaveEntidade(ok)]: { linhas: ['a'] } };
  const res = alocarRealizado([ok, fora, hoje, orf], [a], v, '2026-10-08');
  assert.equal(res.alocacoes.length, 1);
  assert.equal(res.foraDoPeriodo.length, 1);
  assert.equal(res.parcialHoje.length, 1);
  assert.equal(res.orfaos.length, 1);
});

test('sugestão: código da turma liga todos os flights da turma, e não mistura produto', () => {
  const linhas = [
    L('set', '2026-09-14', '2026-09-22', 100),
    L('out', '2026-10-01', '2026-10-19', 100),
    L('lid', '2026-10-01', '2026-10-19', 100, { produto: 'LIDERE', codigosTurma: ['EV-854237'] }),
  ];
  const ents = entidadesDoRealizado([reg('2026-09-15', 100), reg('2026-10-02', 100)]);
  const [s] = sugerirVinculos(ents, linhas);
  assert.equal(s.confianca, 'alta');
  assert.deepEqual(s.linhas.sort(), ['out', 'set']);
});
