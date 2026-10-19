import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCSV, normalizarRealizado, mesclarRealizado, paraCSV } from '../src/core/realizado.js';

test('CSV com ; e números BR, cabeçalhos do export do Meta', () => {
  const csv = 'Dia;Nome da conta;Nome da campanha;Nome do conjunto de anúncios;Valor usado (BRL);Impressões;Cliques no link\n'
    + '18/10/2026;SEBRAE PE;SEBRAEPE_EMPRETEC_LEADS_2026;EV-84162_RECIFE_30A;"1.234,56";10.000;210\n';
  const { registros, avisos } = normalizarRealizado(lerCSV(csv), { plataformaPadrao: 'Meta' });
  assert.deepEqual(avisos, []);
  assert.equal(registros.length, 1);
  const r = registros[0];
  assert.equal(r.data, '2026-10-18');
  assert.equal(r.plataforma, 'META ADS');
  assert.equal(r.gasto, 123456);
  assert.equal(r.cliquesLink, 210);
  assert.equal(r.conjuntoId, 'EV-84162_RECIFE_30A'); // sem ID usa o nome como chave
});

test('CSV canônico com vírgula e ponto decimal', () => {
  const csv = 'data,plataforma,conta_id,campanha_id,campanha_nome,conjunto_id,conjunto_nome,gasto,cliques_link,orcamento_diario_config\n'
    + '2026-10-18,google_ads,123,9,CAMP,77,GRUPO,99.90,12,100.00\n';
  const { registros } = normalizarRealizado(lerCSV(csv));
  assert.equal(registros[0].plataforma, 'GOOGLE ADS');
  assert.equal(registros[0].gasto, 9990);
  assert.equal(registros[0].orcamentoDiario, 10000);
});

test('sem colunas obrigatórias → aviso e nada importado', () => {
  const { registros, avisos } = normalizarRealizado(lerCSV('foo,bar\n1,2\n'));
  assert.equal(registros.length, 0);
  assert.ok(avisos.some((a) => a.includes('data')));
});

test('carga idempotente (upsert por dia × conjunto)', () => {
  const base = { plataforma: 'META ADS', contaId: 'a', campanhaId: 'c', conjuntoId: 's' };
  const r1 = { ...base, data: '2026-10-18', gasto: 100 };
  const { registros } = mesclarRealizado([r1], [{ ...r1, gasto: 150 }, { ...base, data: '2026-10-17', gasto: 90 }]);
  assert.equal(registros.length, 2);
  assert.equal(registros.find((r) => r.data === '2026-10-18').gasto, 150);
});

test('ida e volta do CSV canônico', () => {
  const csv = 'data,plataforma,conta_id,campanha_id,campanha_nome,conjunto_id,conjunto_nome,gasto\n2026-10-18,META ADS,a,c,C,s,S,10.50\n';
  const { registros } = normalizarRealizado(lerCSV(csv));
  const volta = normalizarRealizado(lerCSV(paraCSV(registros))).registros;
  assert.equal(volta[0].gasto, 1050);
});
