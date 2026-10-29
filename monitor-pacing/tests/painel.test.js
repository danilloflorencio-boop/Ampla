import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerXlsx } from './_ler_xlsx.js';
import { lerPlano } from '../src/core/plano.js';
import { gerarRealizadoMock } from '../src/core/mock.js';
import { entidadesDoRealizado } from '../src/core/realizado.js';
import { sugerirVinculos, aplicarSugestoes } from '../src/core/vinculo.js';
import { foraDaMargem, sentido, contasDoCliente, montarPainel, filtrarPainel, soPacing, calcularCliente, ajusteDaLinha, tipoDeOrcamento, agruparPorCliente, ehLideranca, podeGerirEquipe } from '../src/core/painel.js';
import { montarAvisos, linkDaConta } from '../src/core/avisos.js';
import { configDoCliente } from '../src/config/config.js';
import { montarDemo, EQUIPE_DEMO, REF_DEMO } from '../src/demo/demoPainel.js';
import { CONFIG_PADRAO } from '../src/config/config.js';

const FIXTURE = new URL('../fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx', import.meta.url).pathname;
const REF = '2026-10-19';

function workspace(plano, realizado, analista = null) {
  const sug = sugerirVinculos(entidadesDoRealizado(realizado), plano.linhas, {});
  return {
    clienteId: plano.clienteId, cliente: plano.cliente, analista, planos: [plano], planoAtivo: plano.id,
    realizado, vinculos: aplicarSugestoes({}, sug, 'alta').vinculos, config: {},
  };
}

const demo = () => montarDemo(REF_DEMO).map((c) => workspace(c.plano, c.realizado, c.analista));

test('fora da margem: ±10% e até 10 dias do fim, só em linha ativa', () => {
  const m = (indice, diasRestantes, situacao = 'ativa') => ({ indice, diasRestantes, situacao });
  assert.equal(foraDaMargem(m(0.85, 5)), true);
  assert.equal(foraDaMargem(m(1.12, 10)), true, 'o 10º dia ainda está na janela');
  assert.equal(foraDaMargem(m(0.85, 11)), false, 'longe do fim, o ritmo ainda pode se acertar');
  assert.equal(foraDaMargem(m(0.95, 3)), false);
  assert.equal(foraDaMargem(m(1.1, 3)), false, 'exatamente 10% ainda está na margem');
  assert.equal(foraDaMargem(m(0.5, 3, 'encerrada')), false);
  assert.equal(foraDaMargem(m(null, 3)), false);
  const largo = { ...CONFIG_PADRAO, avisos: { ...CONFIG_PADRAO.avisos, margem: 0.2, diasParaFim: 20 } };
  assert.equal(foraDaMargem(m(0.85, 15), largo), false, 'limites vêm da config');
  assert.equal(sentido(1.15), 'acima');
  assert.equal(sentido(0.92), 'no-ritmo');
  assert.equal(sentido(0.8), 'abaixo');
});

test('contas do cliente somam o Investimento Plataforma das linhas ativas', () => {
  const plano = lerPlano(lerXlsx(FIXTURE), { arquivo: 'REV3.xlsx' });
  const ws = workspace(plano, gerarRealizadoMock(plano, REF));
  const contas = contasDoCliente(ws, REF);
  assert.deepEqual(contas.map((c) => c.plataforma), ['META ADS']);
  const [c] = contas;
  const ativas = calcularCliente(ws, REF).metricas.filter((m) => m.situacao === 'ativa');
  assert.equal(c.nAtivas, ativas.length);
  assert.equal(c.investimento, ativas.reduce((s, m) => s + m.investimento, 0));
  assert.ok(Number.isInteger(c.investimento) && Number.isInteger(c.gasto), 'dinheiro em centavos inteiros');
  assert.equal(c.indice, c.gasto / c.planejadoAteOntem);
  assert.ok(c.oscilacao !== null && Number.isFinite(c.oscilacao));
  assert.ok(c.fora.every((m) => foraDaMargem(m)));
});

test('painel junta todos os clientes, como uma MCC, e filtra por analista, liderança e cliente', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const clientes = new Set(painel.contas.map((c) => c.clienteId));
  assert.equal(clientes.size, 4);
  assert.ok(painel.contas.some((c) => c.plataforma === 'GOOGLE ADS'));
  assert.equal(painel.placar.contas, painel.contas.length);
  const daDuda = filtrarPainel(painel.contas, { analista: 'duda.nunes@exemplo.com' }, EQUIPE_DEMO);
  assert.ok(daDuda.length && daDuda.every((c) => c.analista === 'duda.nunes@exemplo.com'));
  const timeHelena = filtrarPainel(painel.contas, { lideranca: 'helena.prado@exemplo.com' }, EQUIPE_DEMO);
  assert.deepEqual([...new Set(timeHelena.map((c) => c.analista))].sort(), ['bruna.lima@exemplo.com', 'caio.rocha@exemplo.com']);
  const sebrae = filtrarPainel(painel.contas, { cliente: 'sebrae-pe' });
  assert.ok(sebrae.length && sebrae.every((c) => c.clienteId === 'sebrae-pe'));
  const fora = filtrarPainel(painel.contas, { situacao: 'fora' });
  assert.ok(fora.length && fora.every((c) => c.fora.length > 0));
});

test('avisos: analista recebe as linhas fora da margem e a liderança direta recebe o overview', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const { avisos, semResponsavel } = montarAvisos(painel.contas, EQUIPE_DEMO, REF_DEMO);
  assert.equal(semResponsavel.length, 0);
  const comFora = painel.contas.filter((c) => c.fora.length);
  const analistas = new Set(comFora.map((c) => c.analista));
  assert.deepEqual(new Set(avisos.filter((a) => a.papel === 'analista').map((a) => a.para)), analistas);
  const lideres = new Set(comFora.map((c) => EQUIPE_DEMO.pessoas.find((p) => p.email === c.analista).lider));
  assert.deepEqual(new Set(avisos.filter((a) => a.papel === 'lideranca').map((a) => a.para)), lideres);
  for (const a of avisos) {
    assert.ok(a.texto.startsWith(`Olá ${a.nome}`));
    assert.ok(!a.texto.includes('{'), `placeholder sem preencher para ${a.para}`);
    assert.ok(/Ação: .*\d/.test(a.texto), 'toda mensagem traz ação com número');
    assert.ok(/\d{2}\/\d{2}/.test(a.texto), 'toda mensagem traz prazo');
  }
  const analista = avisos.find((a) => a.papel === 'analista');
  assert.equal((analista.texto.match(/Ação:/g) || []).length, analista.linhas, 'uma ação por linha fora da margem');
});

test('ninguém recebe aviso quando tudo está dentro da margem', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const calmas = painel.contas.map((c) => ({ ...c, fora: [] }));
  assert.equal(montarAvisos(calmas, EQUIPE_DEMO, REF_DEMO).avisos.length, 0);
});

test('conta com linha fora da margem e sem analista cadastrado fica em semResponsavel', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const contas = painel.contas.map((c) => ({ ...c, analista: null }));
  const r = montarAvisos(contas, EQUIPE_DEMO, REF_DEMO);
  assert.equal(r.avisos.length, 0);
  assert.equal(r.semResponsavel.length, contas.filter((c) => c.fora.length).length);
});

test('foco em pacing: regras de KPI saem da lista', () => {
  const alertas = ['R01', 'R06', 'R07', 'R07b', 'R13'].map((regra) => ({ regra }));
  assert.deepEqual(soPacing(alertas).map((a) => a.regra), ['R01', 'R13']);
});

test('ajuste na plataforma: diário vira a diária necessária; total soma o gasto dos conjuntos e o saldo', () => {
  const m = { saldo: 30000, media: 8000, diariaNecessaria: 6000, entidades: [{ chave: 'a' }, { chave: 'b' }] };
  const diario = new Map([['a', { tipo: 'diario', orcamentoDiario: 5000, gastoAteOntem: 40000 }], ['b', { tipo: 'diario', orcamentoDiario: 4000, gastoAteOntem: 20000 }]]);
  assert.deepEqual(ajusteDaLinha(m, diario), { tipo: 'diario', novo: 6000, atual: 9000, origemAtual: 'configurado', variacao: -3000, total: 90000, nConjuntos: 2 });
  const total = new Map([['a', { tipo: 'vitalicio', orcamentoDiario: null, gastoAteOntem: 40000 }], ['b', { tipo: 'vitalicio', orcamentoDiario: null, gastoAteOntem: 20000 }]]);
  const r = ajusteDaLinha(m, total);
  assert.equal(r.tipo, 'total');
  assert.equal(r.total, 40000 + 20000 + 30000);
  assert.equal(r.atual, 8000, 'sem orçamento configurado, compara com a média');
  assert.equal(ajusteDaLinha(m, new Map()).tipo, 'indefinido');
  assert.equal(ajusteDaLinha({ ...m, saldo: -500 }, diario).tipo, 'esgotada');
  assert.equal(tipoDeOrcamento('Lifetime'), 'vitalicio');
  assert.equal(tipoDeOrcamento('Vitalício'), 'vitalicio');
  assert.equal(tipoDeOrcamento('daily'), 'diario');
  assert.equal(tipoDeOrcamento(''), null);
});

test('aviso do analista traz o link da conta no monitor e o valor a configurar', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const cfg = configDoCliente({ avisos: { linkPainel: 'https://monitor.exemplo/pacing' } });
  const { avisos } = montarAvisos(painel.contas, EQUIPE_DEMO, REF_DEMO, cfg);
  const a = avisos.find((x) => x.papel === 'analista');
  const conta = painel.contas.find((c) => c.id === a.contas[0]);
  assert.ok(a.texto.includes(`Consulte o Monitor de pacing (${linkDaConta(cfg.avisos.linkPainel, conta)})`));
  assert.ok(linkDaConta('https://x/#velho', conta).startsWith('https://x/#cliente='));
  assert.equal(linkDaConta('', conta), '');
  for (const m of conta.fora) {
    if (m.ajuste.tipo === 'diario') assert.ok(a.texto.includes(`para R$`) && a.texto.includes('por dia'));
  }
  const lider = avisos.find((x) => x.papel === 'lideranca');
  assert.ok(lider.texto.includes('(https://monitor.exemplo/pacing)'));
});

test('agrupar por cliente soma as contas ativas e põe quem tem aviso primeiro', () => {
  const painel = montarPainel(demo(), REF_DEMO);
  const grupos = agruparPorCliente(painel.contas);
  assert.equal(grupos.length, 4);
  for (const g of grupos) {
    const ativas = g.contas.filter((c) => c.situacao === 'ativa');
    assert.equal(g.total.investimento, ativas.reduce((s, c) => s + c.investimento, 0));
    assert.equal(g.total.indice, g.total.gasto / g.total.planejadoAteOntem);
  }
  const nFora = grupos.map((g) => g.total.nFora);
  assert.deepEqual(nFora, [...nFora].sort((a, b) => b - a));
});

test('dado desatualizado não vira aviso: a conta aparece como desatualizada', () => {
  const depois = '2026-10-23'; // a demo só tem dados até 19/10
  const painel = montarPainel(demo(), depois);
  const ativas = painel.contas.filter((c) => c.situacao === 'ativa');
  assert.ok(ativas.length);
  assert.ok(ativas.every((c) => c.desatualizado && c.fora.length === 0 && c.sentido === null));
  assert.equal(painel.placar.desatualizadas, ativas.length);
  assert.equal(painel.placar.gasto, 0, 'conta com dado parado fica fora do índice geral');
  const r = montarAvisos(painel.contas, EQUIPE_DEMO, depois);
  assert.equal(r.avisos.length, 0);
  assert.equal(r.desatualizadas.length, ativas.length);
  assert.ok(agruparPorCliente(painel.contas).every((g) => g.total.sentido === null || g.total.nAtivas === 0));
  const vazio = contasDoCliente({ ...demo()[0], realizado: [] }, REF_DEMO);
  assert.ok(vazio.every((c) => c.desatualizado), 'sem realizado nenhum também é desatualizado');
});

test('equipe e avisos: só a liderança acessa, salvo antes do primeiro cadastro de liderança', () => {
  assert.equal(podeGerirEquipe({ pessoas: [] }, null), true, 'equipe vazia: aberta para o primeiro cadastro');
  assert.equal(podeGerirEquipe({ pessoas: [{ nome: 'A', email: 'a@x', lider: null }] }, null), true, 'sem liderança cadastrada');
  assert.equal(ehLideranca(EQUIPE_DEMO, 'helena.prado@exemplo.com'), true);
  assert.equal(ehLideranca(EQUIPE_DEMO, 'bruna.lima@exemplo.com'), false);
  assert.equal(podeGerirEquipe(EQUIPE_DEMO, 'helena.prado@exemplo.com'), true);
  assert.equal(podeGerirEquipe(EQUIPE_DEMO, 'bruna.lima@exemplo.com'), false);
  assert.equal(podeGerirEquipe(EQUIPE_DEMO, null), false, 'sem identificação, bloqueada');
  const soLiderDeAlguem = { pessoas: [{ nome: 'L', email: 'l@x', lider: null }, { nome: 'A', email: 'a@x', lider: 'l@x' }] };
  assert.equal(podeGerirEquipe(soLiderDeAlguem, 'l@x'), true, 'quem é liderança direta de alguém conta como liderança');
  assert.equal(podeGerirEquipe(soLiderDeAlguem, 'a@x'), false);
});
