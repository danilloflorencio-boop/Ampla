import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarCenario, conferirRoteiro } from '../src/demo/cenarios.js';
import { montarPainel, filtrarPainel } from '../src/core/painel.js';
import { montarAvisos } from '../src/core/avisos.js';

// A página de teste do painel só vale se cada caso do roteiro acontecer de verdade.
function rodar(nome) {
  const c = montarCenario(nome);
  const painel = montarPainel(c.workspaces, c.ref);
  const avisos = montarAvisos(painel.contas, c.equipe, c.ref);
  return { c, painel, avisos, conferido: conferirRoteiro(c.roteiro, painel, avisos) };
}

test('cenário com problemas: cada linha do roteiro faz o que promete', () => {
  const { c, painel, avisos, conferido } = rodar('problemas');
  assert.ok(new Set(painel.contas.map((x) => x.clienteId)).size >= 12, 'carteira com pelo menos 12 clientes');
  for (const r of conferido) assert.ok(r.ok, `${r.cliente} · ${r.produto} (${r.simula}): esperado ${JSON.stringify(r.espera)}, obtido ${JSON.stringify(r.obtido)}`);
  const acoes = new Set(c.roteiro.filter((r) => r.espera.aviso).map((r) => r.espera.acao));
  for (const a of ['diario', 'total', 'indefinido', 'parado', 'esgotada']) assert.ok(acoes.has(a), `faltou um caso de ${a}`);
  for (const k of ['desatualizado', 'semResponsavel', 'agendada', 'encerrada']) assert.ok(c.roteiro.some((r) => r.espera[k]), `faltou um caso de ${k}`);
  assert.ok(c.roteiro.some((r) => !r.espera.aviso && Math.abs(r.fator - 1) > 0.1), 'falta um caso fora da margem, mas longe do fim');
  assert.ok(avisos.avisos.some((a) => a.papel === 'analista') && avisos.avisos.some((a) => a.papel === 'lideranca'));
  assert.ok(painel.placar.acima && painel.placar.abaixo && painel.placar.noRitmo && painel.placar.desatualizadas);
});

test('cenário tudo certo: tudo no ritmo e o chat em silêncio', () => {
  const { painel, avisos, conferido } = rodar('tudo-certo');
  const ativas = painel.contas.filter((x) => x.situacao === 'ativa');
  assert.ok(ativas.length > 10);
  assert.ok(ativas.every((x) => x.sentido === 'no-ritmo' && !x.desatualizado && x.fora.length === 0), 'todas as contas ativas no ritmo');
  assert.ok(conferido.every((r) => r.ok));
  assert.equal(avisos.avisos.length, 0);
  assert.equal(avisos.semResponsavel.length, 0);
  assert.equal(avisos.desatualizadas.length, 0);
  assert.equal(filtrarPainel(painel.contas, { situacao: 'fora' }).length, 0);
});
