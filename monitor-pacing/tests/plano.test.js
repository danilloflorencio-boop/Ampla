import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerXlsx } from './_ler_xlsx.js';
import { lerPlano, datasDaTurma, diffPlanos } from '../src/core/plano.js';

const FIXTURE = new URL('../fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx', import.meta.url).pathname;
const plano = lerPlano(lerXlsx(FIXTURE), { arquivo: 'SEBRAE - EMPRETEC + LIDERE REV3.xlsx' });

test('lê cliente, veículo, versão e as 4 abas como flights', () => {
  assert.equal(plano.cliente, 'SEBRAE PE');
  assert.equal(plano.veiculo, 'RedMídia');
  assert.equal(plano.versao, 'REV3');
  assert.deepEqual(plano.flights.map((f) => f.aba), [
    'PERFORMANCE_SETEMBRO_1', 'PERFORMANCE_SETEMBRO_2', 'PERFORMANCE_OUTUBRO', 'PERFORMANCE_OUTUBRO_Acrescimo',
  ]);
  assert.deepEqual(plano.flights.map((f) => f.linhaIds.length), [14, 12, 10, 5]);
});

test('o valor monitorado é a coluna Investimento Plataforma R$ (totais por aba)', () => {
  // soma das linhas (centavos). O TOTAL da planilha difere em centavos por arredondamento.
  assert.deepEqual(plano.flights.map((f) => f.investimento), [1757958, 905434, 2168354, 573713]);
  const l = plano.linhas.find((x) => x.codigoRaw === 'EV-122104');
  assert.equal(l.investimento, 14610);
  assert.equal(l.dias, 21);
  assert.equal(l.diariaPlan, 696); // R$ 146,10 ÷ 21 = R$ 6,96 (igual à planilha)
});

test('parâmetros da cascata lidos por aba', () => {
  const p = plano.flights[0].params;
  assert.equal(p.divisorBrutoVeiculo, 0.98);
  assert.equal(p.comissao, 0.2);
  assert.equal(p.descontoPlataforma, 0.1215);
  assert.equal(plano.flights[0].meta, 775);
});

test('validações encontram os problemas reais do plano', () => {
  const n = (c) => plano.avisos.filter((a) => a.codigo === c).length;
  assert.equal(n('V1_PERIODO_FORA_DA_ABA'), 5);
  assert.equal(n('V2_PCT_TOTAL'), 1);           // Acréscimo fecha em 62,5%
  assert.equal(n('V2_PCT_ZERADO'), 2);
  assert.equal(n('V3_RESUMO_PLATAFORMA'), 4);   // resumo não bate em nenhuma aba
  assert.equal(n('V4_METRICA_KPI'), 4);         // LEADS × CPC, agrupado por aba
  assert.equal(n('V6_SOBREPOSICAO'), 1);        // EV-84164 em Out e Acréscimo
  assert.equal(n('V8_CUSTO_FORA_DA_CURVA'), 1); // LIDERE Recife a R$ 40,00
  assert.equal(n('V13_SEM_CODIGO'), 3);
  assert.equal(n('V2_TOTAL'), 0);               // soma das linhas bate com o TOTAL
});

test('linhas multi-turma e especiais', () => {
  const multi = plano.linhas.find((l) => l.codigoRaw.includes('EV-84693'));
  assert.deepEqual(multi.codigosTurma, ['EV-84693', 'EV-854167']);
  assert.equal(multi.tipoCodigo, 'multi');
  assert.equal(plano.linhas.find((l) => l.codigoRaw === 'EXTRA').tipoCodigo, 'extra');
  assert.equal(plano.linhas.find((l) => l.codigoRaw === 'NAO DISPONÍVEL').tipoCodigo, 'indisponivel');
});

test('datas da turma a partir de texto livre', () => {
  assert.deepEqual(datasDaTurma('19 e 20 \n26 e 27/10', '2026-10-01'), ['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-27']);
  assert.deepEqual(datasDaTurma('25, 26/09, 02 e 03/10 (Const. Civil)', '2026-09-02'), ['2026-09-25', '2026-09-26', '2026-10-02', '2026-10-03']);
  assert.equal(datasDaTurma('20, 21, 27 e 28/10 - 1ª turma\n22, 23, 29 e 30/10 - 2ª turma', '2026-10-13')[0], '2026-10-20');
  assert.deepEqual(datasDaTurma('TURMA 1 - 23 A 27/11 \nTURMA 2 - 30/11 A 04/12', '2026-10-01'), ['2026-11-23', '2026-11-27', '2026-11-30', '2026-12-04']);
  assert.deepEqual(datasDaTurma('-', '2026-10-01'), []);
});

test('diff entre versões do plano', () => {
  const novo = structuredClone(plano);
  novo.linhas[0].investimento += 10000;
  novo.linhas.pop();
  const d = diffPlanos(plano, novo);
  assert.equal(d.alteradas.length, 1);
  assert.equal(d.alteradas[0].campos[0].campo, 'investimento');
  assert.equal(d.removidas.length, 1);
});
