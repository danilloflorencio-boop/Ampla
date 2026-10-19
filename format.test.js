import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumero, paraCentavos, parsePercentual, parseData, diasInclusivos, addDias, fimDoMes, extrairCodigosTurma } from '../src/core/format.js';

test('parseNumero aceita formatos BR e US', () => {
  assert.equal(parseNumero('R$ 1.234,56'), 1234.56);
  assert.equal(parseNumero('1234.56'), 1234.56);
  assert.equal(parseNumero('207,8878'), 207.8878);
  assert.equal(parseNumero('1.234.567'), 1234567);
  assert.equal(parseNumero(''), null);
  assert.equal(parseNumero('-'), null);
  assert.equal(parseNumero(42), 42);
});

test('dinheiro vira centavos inteiros', () => {
  assert.equal(paraCentavos('R$ 207,8878'), 20789);
  assert.equal(paraCentavos(146.1), 14610);
  assert.equal(paraCentavos('R$ 17.579,59'), 1757959);
});

test('percentuais', () => {
  assert.equal(parsePercentual('12,15%'), 0.1215);
  assert.equal(parsePercentual(0.98), 0.98);
  assert.equal(parsePercentual(20), 0.2);
});

test('datas', () => {
  assert.equal(parseData('02/09/2026'), '2026-09-02');
  assert.equal(parseData('2026-09-02T00:00:00'), '2026-09-02');
  assert.equal(parseData(46267), '2026-09-02'); // serial Excel
  assert.equal(parseData(new Date(2026, 8, 2)), '2026-09-02');
  assert.equal(diasInclusivos('2026-09-02', '2026-09-22'), 21); // contagem do plano
  assert.equal(addDias('2026-09-30', 1), '2026-10-01');
  assert.equal(fimDoMes('2026-02-10'), '2026-02-28');
});

test('códigos de turma', () => {
  assert.deepEqual(extrairCodigosTurma('TURMA 1 - EV-84693 \nTURMA 2 - EV-854167'), ['EV-84693', 'EV-854167']);
  assert.deepEqual(extrairCodigosTurma('NAO DISPONÍVEL'), []);
  assert.deepEqual(extrairCodigosTurma('ev 84162_recife'), ['EV-84162']);
});
