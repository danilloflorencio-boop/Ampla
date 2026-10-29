// Painel integrador: todas as contas da Ampla numa tela só, como uma MCC.
// Cliente → contas (uma por plataforma) → linhas do plano. Só pacing: investimento, usado,
// índice, desvio, projeção. O dia de referência continua parcial (ver pacing.js).

import { addDias } from './format.js';
import { chaveEntidade, ultimaExtracao } from './realizado.js';
import { frescorDosDados } from './regras.js';
import { alocarRealizado } from './vinculo.js';
import { calcularTudo, agregar } from './pacing.js';
import { configDoCliente, configPlataforma, CONFIG_PADRAO } from '../config/config.js';

// Comparações de margem com folga de arredondamento: índice 1,10 é "exatamente 10%", não fora.
const EPS = 1e-9;

export const planoAtivo = (ws) => ws?.planos?.find((p) => p.id === ws.planoAtivo) || ws?.planos?.[0] || null;

/** Pacing de um cliente na data de referência (sem regras e sem alertas). */
export function calcularCliente(ws, ref) {
  const plano = planoAtivo(ws);
  if (!plano) return null;
  const cfg = configDoCliente(ws.config);
  const alloc = alocarRealizado(ws.realizado || [], plano.linhas, ws.vinculos || {}, ref);
  const { metricas, total } = calcularTudo(plano.linhas, alloc.alocacoes, ref, cfg);
  return { plano, cfg, alloc, metricas, total };
}

/**
 * A linha merece aviso no chat? Só quando está ativa, saiu da margem (±10% por padrão)
 * e faltam até N dias para acabar (10 por padrão, contando hoje). Antes da janela final
 * o ritmo ainda oscila e tem tempo de se acertar.
 */
export function foraDaMargem(m, cfg = CONFIG_PADRAO) {
  if (m.situacao !== 'ativa' || m.indice === null || m.indice === undefined || !Number.isFinite(m.indice)) return false;
  return Math.abs(m.indice - 1) > cfg.avisos.margem + EPS && m.diasRestantes <= cfg.avisos.diasParaFim;
}

/** Sentido do ritmo na margem do painel: 'acima', 'abaixo' ou 'no-ritmo' (null sem dados). */
export function sentido(indice, cfg = CONFIG_PADRAO) {
  if (indice === null || indice === undefined || !Number.isFinite(indice)) return null;
  const d = indice - 1;
  if (Math.abs(d) <= cfg.avisos.margem + EPS) return 'no-ritmo';
  return d > 0 ? 'acima' : 'abaixo';
}

/** Tipo de orçamento como vem dos conectores ('diario', 'daily', 'vitalício', 'lifetime', 'total'…). */
export function tipoDeOrcamento(v) {
  const s = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/vitalic|lifetime|total/.test(s)) return 'vitalicio';
  if (/diari|daily|dia/.test(s)) return 'diario';
  return null;
}

/**
 * Orçamento dos conjuntos na plataforma, a partir do realizado: tipo (diário ou total/vitalício),
 * último orçamento diário configurado e gasto acumulado do conjunto até ontem (em todas as linhas).
 */
export function orcamentosDosConjuntos(registros, ref) {
  const ontem = addDias(ref, -1);
  const out = new Map();
  for (const r of registros || []) {
    if (r.data > ontem) continue;
    const k = chaveEntidade(r);
    const o = out.get(k) || { tipo: null, orcamentoDiario: null, gastoAteOntem: 0, ultimoDia: '' };
    o.gastoAteOntem += r.gasto || 0;
    if (r.data >= o.ultimoDia) {
      o.ultimoDia = r.data;
      o.tipo = tipoDeOrcamento(r.tipoOrcamento) || o.tipo;
      o.orcamentoDiario = r.orcamentoDiario ?? o.orcamentoDiario;
    }
    out.set(k, o);
  }
  return out;
}

/**
 * Quanto ajustar na plataforma para a linha fechar no Investimento Plataforma.
 *   • orçamento diário: novo = diária necessária (saldo ÷ dias restantes);
 *   • orçamento total (vitalício): novo total = gasto acumulado dos conjuntos + saldo da linha;
 *   • sem informação de tipo: assume diário e informa também o total equivalente.
 * Valores em centavos.
 */
export function ajusteDaLinha(m, orcamentos) {
  const conj = m.entidades.map((e) => orcamentos.get(e.chave)).filter(Boolean);
  const saldo = Math.max(0, m.saldo);
  const total = conj.reduce((s, o) => s + o.gastoAteOntem, 0) + saldo;
  if (m.saldo <= 0) return { tipo: 'esgotada', novo: 0, atual: null, variacao: null, total, nConjuntos: conj.length };
  const tipos = new Set(conj.map((o) => o.tipo).filter(Boolean));
  const tipo = tipos.size === 1 && tipos.has('vitalicio') ? 'total' : tipos.size === 1 && tipos.has('diario') ? 'diario' : 'indefinido';
  const configurados = conj.map((o) => o.orcamentoDiario);
  const diarioConfigurado = conj.length && configurados.every((v) => v !== null && v !== undefined) ? configurados.reduce((s, v) => s + v, 0) : null;
  const atual = diarioConfigurado ?? m.media;
  const novo = m.diariaNecessaria ?? 0;
  return { tipo, novo, atual, origemAtual: diarioConfigurado === null ? 'media' : 'configurado', variacao: novo - atual, total, nConjuntos: conj.length };
}

/**
 * Contas de um cliente: uma por plataforma. Os números consideram só as linhas em veiculação
 * na data de referência (o que ainda dá para ajustar). A oscilação compara o índice de hoje
 * com o das mesmas linhas um dia antes.
 */
export function contasDoCliente(ws, ref) {
  const hoje = calcularCliente(ws, ref);
  if (!hoje) return [];
  const orcamentos = orcamentosDosConjuntos(ws.realizado, ref);
  const frescor = frescorDosDados(ws.realizado, ultimaExtracao(ws.realizado || []), ref, hoje.cfg);
  const ontem = calcularCliente(ws, addDias(ref, -1));
  const metOntem = new Map(ontem.metricas.map((m) => [m.linhaId, m]));
  const { cfg } = hoje;
  const plataformas = [...new Set(hoje.metricas.map((m) => m.linha.plataforma))].sort();
  return plataformas.map((plat) => {
    const todas = hoje.metricas.filter((m) => m.linha.plataforma === plat);
    const ativas = todas.filter((m) => m.situacao === 'ativa');
    const t = agregar(ativas, cfg);
    const tOntem = agregar(ativas.map((m) => metOntem.get(m.linhaId)).filter((m) => m && m.situacao !== 'agendada'), cfg);
    // dado parado não vira aviso: "70% abaixo" com a carga atrasada é falso alarme
    const fora = frescor.desatualizado ? [] : ativas.filter((m) => foraDaMargem(m, cfg)).map((m) => ({ ...m, ajuste: ajusteDaLinha(m, orcamentos) }));
    const fins = ativas.map((m) => m.linha.fim).sort();
    const situacao = ativas.length ? 'ativa' : todas.some((m) => m.situacao === 'agendada') ? 'agendada' : 'encerrada';
    const contas = [...new Set((ws.realizado || []).filter((r) => r.plataforma === plat).map((r) => r.contaNome || r.contaId).filter(Boolean))];
    return {
      id: `${ws.clienteId}|${plat}`,
      clienteId: ws.clienteId,
      cliente: ws.cliente,
      analista: ws.analista || null,
      plataforma: plat,
      plataformaNome: configPlataforma(plat).nome,
      contas,
      situacao,
      nAtivas: ativas.length,
      investimento: t.investimento,
      planejadoAteOntem: t.planejadoAteOntem,
      gasto: t.gasto,
      saldo: t.saldo,
      indice: t.indice,
      indiceOntem: tOntem.indice,
      oscilacao: t.indice !== null && tOntem.indice !== null ? t.indice - tOntem.indice : null,
      desvio: t.indice === null ? null : t.indice - 1,
      sentido: frescor.desatualizado ? null : sentido(t.indice, cfg),
      desatualizado: frescor.desatualizado,
      ultimoDiaDados: frescor.ultimoDiaDados,
      status: ativas.length && frescor.desatualizado ? { codigo: 'desatualizado', rotulo: 'Dados desatualizados' } : ativas.length ? t.status : situacao === 'agendada' ? { codigo: 'agendada', rotulo: 'Agendada' } : { codigo: 'encerrada', rotulo: 'Encerrada' },
      media: t.media,
      diariaNecessaria: t.diariaNecessaria,
      projecaoFim: t.projecaoFim,
      desvioProjetado: t.desvioProjetado,
      proximoFim: fins[0] || null,
      ultimoFim: fins.at(-1) || null,
      diasParaFim: ativas.length ? Math.min(...ativas.map((m) => m.diasRestantes)) : null,
      fora,
      metricas: ativas,
    };
  });
}

/** Todas as contas de todos os clientes, com o placar do topo do painel. */
export function montarPainel(workspaces, ref) {
  const contas = workspaces.flatMap((ws) => contasDoCliente(ws, ref));
  return { ref, contas, placar: placar(contas) };
}

export function placar(contas) {
  const ativas = contas.filter((c) => c.situacao === 'ativa');
  const emDia = ativas.filter((c) => !c.desatualizado);
  const n = (s) => ativas.filter((c) => c.sentido === s).length;
  return {
    contas: contas.length,
    ativas: ativas.length,
    noRitmo: n('no-ritmo'),
    acima: n('acima'),
    abaixo: n('abaixo'),
    comAviso: contas.filter((c) => c.fora.length).length,
    desatualizadas: ativas.filter((c) => c.desatualizado).length,
    linhasComAviso: contas.reduce((s, c) => s + c.fora.length, 0),
    // totais só com dado em dia: conta parada puxaria o índice geral para baixo sem motivo
    investimento: emDia.reduce((s, c) => s + c.investimento, 0),
    gasto: emDia.reduce((s, c) => s + c.gasto, 0),
    planejadoAteOntem: emDia.reduce((s, c) => s + c.planejadoAteOntem, 0),
  };
}

/**
 * Agrupa as contas por cliente (a "MCC"): total do cliente sobre as contas ativas, com o
 * mesmo índice (usado ÷ previsto até ontem). Clientes com aviso no chat vêm primeiro.
 */
export function agruparPorCliente(contas, cfg = CONFIG_PADRAO) {
  const m = new Map();
  for (const c of contas) {
    if (!m.has(c.clienteId)) m.set(c.clienteId, { clienteId: c.clienteId, cliente: c.cliente, analista: c.analista, contas: [] });
    m.get(c.clienteId).contas.push(c);
  }
  return [...m.values()].map((g) => {
    const ativas = g.contas.filter((c) => c.situacao === 'ativa');
    const s = (k) => ativas.reduce((t, c) => t + (c[k] || 0), 0);
    const indice = s('planejadoAteOntem') > 0 ? s('gasto') / s('planejadoAteOntem') : null;
    return {
      ...g,
      total: {
        investimento: s('investimento'), planejadoAteOntem: s('planejadoAteOntem'), gasto: s('gasto'), projecaoFim: s('projecaoFim'),
        // com alguma conta de dado parado, o total do cliente não tem sentido confiável
        indice, desvio: indice === null ? null : indice - 1, sentido: ativas.some((c) => c.desatualizado) ? null : sentido(indice, cfg),
        nFora: g.contas.reduce((t, c) => t + c.fora.length, 0), nAtivas: ativas.length,
      },
    };
  }).sort((a, b) => b.total.nFora - a.total.nFora || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

/** Pessoas lideradas diretamente por `email` (sem contar a própria pessoa). */
export const liderados = (equipe, email) => (equipe?.pessoas || []).filter((p) => p.lider === email).map((p) => p.email);

/**
 * Filtros do painel. analista: só as contas dessa pessoa. lideranca: contas dos liderados
 * diretos e da própria liderança. situacao: 'fora' (com aviso), 'acima', 'abaixo', 'no-ritmo'.
 */
export function filtrarPainel(contas, filtro = {}, equipe = { pessoas: [] }) {
  const time = filtro.lideranca ? new Set([filtro.lideranca, ...liderados(equipe, filtro.lideranca)]) : null;
  return contas.filter((c) => (!filtro.analista || c.analista === filtro.analista)
    && (!time || time.has(c.analista))
    && (!filtro.cliente || c.clienteId === filtro.cliente)
    && (!filtro.plataforma || c.plataforma === filtro.plataforma)
    && (!filtro.situacao || (filtro.situacao === 'fora' ? c.fora.length > 0 : c.situacao === 'ativa' && c.sentido === filtro.situacao)));
}

/** Tira do conjunto as regras de KPI (custo unitário e resultado): o monitor é só de pacing. */
export function soPacing(alertas, cfg = CONFIG_PADRAO) {
  const fora = new Set(cfg.regrasDeKpi || []);
  return alertas.filter((a) => !fora.has(a.regra));
}
