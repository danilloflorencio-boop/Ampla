import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metricasLinha, agregar, classificar, series } from '../src/core/pacing.js';
import { intervalo } from '../src/core/format.js';

const linha = (extra = {}) => ({
  id: 'f:L1', flightId: 'f', aba: 'F', plataforma: 'META ADS', produto: 'X', praca: 'P', codigoRaw: 'EV-1', codigosTurma: ['EV-1'],
  inicio: '2026-10-01', fim: '2026-10-10', dias: 10, investimento: 100000, diariaPlan: 10000,
  kpi: 'CPC', custoUnitPlan: 500, resultadosPlan: 200, ...extra,
});
const alocs = (de, ate, gastoDia, cliquesDia) =>
  intervalo(de, ate).map((data) => ({ linhaId: 'f:L1', chave: 'k', data, gasto: gastoDia, cliquesLink: cliquesDia, cliques: cliquesDia, leads: 1 }));

test('agendada antes do início', () => {
  const m = metricasLinha(linha(), [], '2026-09-30');
  assert.equal(m.situacao, 'agendada');
  assert.equal(m.planejadoAteOntem, 0);
  assert.equal(m.projecaoFim, 100000); // projeta o plano
});

test('no ritmo: 5 dias fechados a R$ 100/dia', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 10000, 20), '2026-10-06');
  assert.equal(m.diasDecorridos, 5);
  assert.equal(m.diasRestantes, 5);
  assert.equal(m.planejadoAteOntem, 50000);
  assert.equal(m.indice, 1);
  assert.equal(m.status.codigo, 'ok');
  assert.equal(m.diariaNecessaria, 10000);
  assert.equal(m.projecaoFim, 100000);
  assert.equal(m.custoUnitReal, 500);
});

test('abaixo do ritmo: diária necessária e projeção', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 5000, 10), '2026-10-06');
  assert.equal(m.indice, 0.5);
  assert.equal(m.status.codigo, 'critico-under');
  assert.equal(m.diariaNecessaria, 15000); // (1000 − 250) ÷ 5
  assert.equal(m.projecaoFim, 50000);     // mantém média de R$ 50
  assert.equal(m.media, 5000);
});

test('acima do ritmo e data de esgotamento', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 15000, 30), '2026-10-06');
  assert.equal(m.status.codigo, 'critico-over');
  assert.equal(m.dataEsgotamento, '2026-10-07'); // saldo 250 ÷ 150/dia
});

test('dia corrente não entra (dados de hoje ficam fora)', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 10000, 20), '2026-10-06');
  assert.equal(m.gasto, 50000);
});

test('encerrada usa gasto final ÷ investimento', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-10', 9500, 20), '2026-10-15');
  assert.equal(m.situacao, 'encerrada');
  assert.equal(m.projecaoFim, 95000);
  assert.equal(m.status.codigo, 'ok'); // −5%
});

test('flight cruzando o mês: previsto até o fim do mês', () => {
  const l = linha({ inicio: '2026-09-25', fim: '2026-10-04' });
  const m = metricasLinha(l, alocs('2026-09-25', '2026-09-27', 10000, 20), '2026-09-28');
  assert.equal(m.planejadoNoMes, 60000); // 25..30/09 = 6 dias
  assert.equal(m.gastoNoMes, 30000);
  assert.equal(m.previstoNoMes, 60000);  // + 3 dias (28..30) × média R$ 100
});

test('sem veiculação após D+3', () => {
  const m = metricasLinha(linha(), [], '2026-10-06');
  assert.equal(m.status.codigo, 'sem-veiculacao');
});

test('CPM calcula custo por mil', () => {
  const l = linha({ kpi: 'CPM', custoUnitPlan: 2000, resultadosPlan: 50000 });
  const a = intervalo('2026-10-01', '2026-10-02').map((data) => ({ linhaId: 'f:L1', chave: 'k', data, gasto: 10000, impressoes: 5000 }));
  const m = metricasLinha(l, a, '2026-10-03');
  assert.equal(m.custoUnitReal, 2000); // R$ 100 ÷ 5.000 × 1.000 = R$ 20
});

test('agregação e classificação', () => {
  const a = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 10000, 20), '2026-10-06');
  const b = metricasLinha(linha({ id: 'f:L2' }), alocs('2026-10-01', '2026-10-05', 5000, 10).map((x) => ({ ...x, linhaId: 'f:L2' })), '2026-10-06');
  const t = agregar([a, b]);
  assert.equal(t.investimento, 200000);
  assert.equal(t.indice, 0.75);
  assert.equal(t.status.codigo, 'critico-under');
  assert.equal(classificar(1.05).codigo, 'ok');
  assert.equal(classificar(1.15).codigo, 'atencao-over');
  assert.equal(classificar(0.85).codigo, 'atencao-under');
});

test('séries acumuladas para o gráfico', () => {
  const m = metricasLinha(linha(), alocs('2026-10-01', '2026-10-05', 10000, 20), '2026-10-06');
  const s = series([m], '2026-10-06');
  assert.equal(s.datas.length, 10);
  assert.equal(s.planejadoAcum.at(-1), 100000);
  assert.equal(s.realizadoAcum[4], 50000);
  assert.equal(s.realizadoAcum[5], null);
  assert.equal(s.projecaoAcum.at(-1), 100000);
});
