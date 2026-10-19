// Motor de cálculo de pacing — 100% determinístico, sem IA.
// Base: coluna "Investimento Plataforma R$" de cada linha do plano.
// Convenções:
//   • "ref" = data de referência (normalmente hoje, fuso America/Sao_Paulo). O dia de ref é
//     parcial: não entra em gasto acumulado, médias nem projeções.
//   • Dias fechados = do início da linha até ontem (ref − 1), limitado ao fim da linha.
//   • Dias restantes = de max(ref, início) até o fim da linha, inclusivo.

import { addDias, diasInclusivos, maxData, minData, inicioDoMes, fimDoMes, intervalo } from './format.js';
import { KPIS, CONFIG_PADRAO } from '../config/config.js';

const kpiDe = (linha) => KPIS[linha.kpi] || KPIS.CPC;

function valorResultado(a, kpi) {
  const v = a[kpi.resultado];
  if (v !== null && v !== undefined) return v;
  return kpi.fallback ? a[kpi.fallback] ?? 0 : 0;
}

/** Classifica o índice de pacing nas faixas da config. */
export function classificar(indice, cfg = CONFIG_PADRAO) {
  if (indice === null || indice === undefined || !Number.isFinite(indice)) return { codigo: 'sem-dados', rotulo: 'Sem dados' };
  const d = indice - 1;
  if (Math.abs(d) <= cfg.status.noRitmo) return { codigo: 'ok', rotulo: 'No ritmo' };
  const sentido = d < 0 ? 'under' : 'over';
  const nivel = Math.abs(d) <= cfg.status.atencao ? 'atencao' : 'critico';
  const rotulo = `${nivel === 'atencao' ? 'Atenção' : 'Crítico'} · ${sentido === 'under' ? 'abaixo' : 'acima'}`;
  return { codigo: `${nivel}-${sentido}`, rotulo };
}

/** Agrupa alocações por linha (índice para não varrer tudo a cada linha). */
export function indexarAlocacoes(alocacoes) {
  const m = new Map();
  for (const a of alocacoes) {
    if (!m.has(a.linhaId)) m.set(a.linhaId, []);
    m.get(a.linhaId).push(a);
  }
  return m;
}

/**
 * Métricas de uma linha do plano.
 * @param {object} linha
 * @param {object[]} alocs  alocações desta linha (só dias fechados)
 * @param {string} ref      data de referência ISO
 * @param {object} cfg
 */
export function metricasLinha(linha, alocs = [], ref, cfg = CONFIG_PADRAO) {
  const ontem = addDias(ref, -1);
  const kpi = kpiDe(linha);
  const fimFechado = minData(ontem, linha.fim);
  const diasDecorridos = linha.inicio > ontem ? 0 : diasInclusivos(linha.inicio, fimFechado);
  const diasRestantes = linha.fim < ref ? 0 : diasInclusivos(maxData(ref, linha.inicio), linha.fim);
  const situacao = linha.fim < ref ? 'encerrada' : diasDecorridos === 0 ? 'agendada' : 'ativa';

  const diaria = linha.diariaPlan || 0;
  const planejadoAteOntem = diasDecorridos >= linha.dias ? linha.investimento : Math.min(linha.investimento, diaria * diasDecorridos);

  const porDia = new Map();
  const porEntidade = new Map();
  let gasto = 0, resultado = 0, leads = 0, cliques = 0, impressoes = 0;
  for (const a of alocs) {
    const res = valorResultado(a, kpi);
    gasto += a.gasto || 0;
    resultado += res;
    leads += a.leads || 0;
    cliques += a.cliquesLink ?? a.cliques ?? 0;
    impressoes += a.impressoes || 0;
    const d = porDia.get(a.data) || { gasto: 0, resultado: 0 };
    d.gasto += a.gasto || 0; d.resultado += res;
    porDia.set(a.data, d);
    const e = porEntidade.get(a.chave) || { chave: a.chave, gasto: 0, resultado: 0, dias: new Set(), orcamentoDiario: null, ultimoDia: null };
    e.gasto += a.gasto || 0; e.resultado += res; e.dias.add(a.data);
    if (!e.ultimoDia || a.data >= e.ultimoDia) { e.ultimoDia = a.data; e.orcamentoDiario = a.orcamentoDiario ?? e.orcamentoDiario; }
    porEntidade.set(a.chave, e);
  }

  // média móvel dos últimos N dias fechados dentro da linha
  const n = Math.min(cfg.janelaMediaDias, diasDecorridos);
  let somaJanela = 0, resJanela = 0;
  for (let i = 0; i < n; i++) {
    const d = porDia.get(addDias(fimFechado, -i));
    if (d) { somaJanela += d.gasto; resJanela += d.resultado; }
  }
  const media = n ? Math.round(somaJanela / n) : 0;
  const ritmoResultado = n ? resJanela / n : 0;

  const indice = planejadoAteOntem > 0 ? gasto / planejadoAteOntem : null;
  const saldo = linha.investimento - gasto;
  const diariaNecessaria = diasRestantes > 0 ? Math.max(0, Math.round(saldo / diasRestantes)) : null;
  const taxaFutura = situacao === 'agendada' ? diaria : media;
  const projecaoFim = situacao === 'encerrada' ? gasto : gasto + taxaFutura * diasRestantes;

  // fim do mês de ref
  const mesIni = inicioDoMes(ref), mesFim = fimDoMes(ref);
  const iniMes = maxData(linha.inicio, mesIni), fimMes = minData(linha.fim, mesFim);
  const diasNoMes = fimMes < iniMes ? 0 : diasInclusivos(iniMes, fimMes);
  const planejadoNoMes = diasNoMes === linha.dias ? linha.investimento : Math.min(linha.investimento, diaria * diasNoMes);
  let gastoNoMes = 0;
  for (const [data, d] of porDia) if (data >= mesIni && data <= mesFim) gastoNoMes += d.gasto;
  const iniRest = maxData(ref, iniMes);
  const restantesNoMes = fimMes < iniRest ? 0 : diasInclusivos(iniRest, fimMes);
  const previstoNoMes = gastoNoMes + taxaFutura * restantesNoMes;

  // resultados (definidos pelo KPI)
  const custoUnitReal = resultado > 0 ? Math.round((gasto / resultado) * (kpi.porMil ? 1000 : 1)) : null;
  const ritmoRes = situacao === 'agendada' ? (linha.resultadosPlan || 0) / (linha.dias || 1) : ritmoResultado;
  const resultadoProjetado = situacao === 'encerrada' ? resultado : resultado + ritmoRes * diasRestantes;
  const pctMeta = linha.resultadosPlan ? resultadoProjetado / linha.resultadosPlan : null;

  const semVeiculacao = situacao !== 'agendada' && gasto === 0 && diasDecorridos > cfg.diasSetup;
  const indiceStatus = situacao === 'encerrada' ? gasto / (linha.investimento || 1) : indice;
  const status = semVeiculacao ? { codigo: 'sem-veiculacao', rotulo: 'Sem veiculação' }
    : situacao === 'agendada' ? { codigo: 'agendada', rotulo: 'Agendada' }
    : classificar(indiceStatus, cfg);

  return {
    linhaId: linha.id, linha, kpi: linha.kpi || 'CPC', rotuloResultado: kpi.rotulo, situacao, status,
    diasTotais: linha.dias, diasDecorridos, diasRestantes,
    pctTempo: linha.dias ? diasDecorridos / linha.dias : null,
    investimento: linha.investimento, gasto, saldo, planejadoAteOntem,
    pctConsumido: linha.investimento ? gasto / linha.investimento : null,
    indice, indiceStatus,
    diariaPlan: diaria, media, diariaNecessaria, projecaoFim,
    desvioProjetado: linha.investimento ? projecaoFim / linha.investimento - 1 : null,
    dataEsgotamento: media > 0 && saldo > 0 && situacao === 'ativa' ? addDias(ref, Math.floor(saldo / media)) : null,
    planejadoNoMes, gastoNoMes, previstoNoMes,
    resultado, resultadosPlan: linha.resultadosPlan, resultadoProjetado, pctMeta,
    custoUnitPlan: linha.custoUnitPlan, custoUnitReal,
    leads, cliques, impressoes,
    porDia, entidades: [...porEntidade.values()].map((e) => ({ ...e, dias: e.dias.size })).sort((a, b) => b.gasto - a.gasto),
  };
}

/** Soma métricas de várias linhas (plataforma, produto, flight, turma, cliente). */
export function agregar(lista, cfg = CONFIG_PADRAO) {
  const s = (campo) => lista.reduce((t, m) => t + (m[campo] || 0), 0);
  const ativas = lista.filter((m) => m.situacao === 'ativa');
  const planejadoAteOntem = s('planejadoAteOntem');
  const gasto = s('gasto');
  const investimento = s('investimento');
  const encerradasTodas = lista.length && lista.every((m) => m.situacao === 'encerrada');
  const indice = planejadoAteOntem > 0 ? gasto / planejadoAteOntem : null;
  const kpis = new Set(lista.map((m) => m.kpi));
  const resultado = s('resultado');
  const mesmoKpi = kpis.size === 1;
  const kpi = mesmoKpi ? [...kpis][0] : null;
  const porMil = kpi ? (KPIS[kpi] || KPIS.CPC).porMil : false;
  const contagem = {};
  for (const m of lista) contagem[m.status.codigo] = (contagem[m.status.codigo] || 0) + 1;
  const algumaSemVeic = lista.some((m) => m.status.codigo === 'sem-veiculacao');
  return {
    n: lista.length, kpi, contagem,
    investimento, gasto, saldo: investimento - gasto, planejadoAteOntem,
    pctConsumido: investimento ? gasto / investimento : null,
    indice,
    status: !lista.length ? { codigo: 'sem-dados', rotulo: 'Sem linhas' }
      : lista.every((m) => m.situacao === 'agendada') ? { codigo: 'agendada', rotulo: 'Agendada' }
      : classificar(encerradasTodas ? gasto / (investimento || 1) : indice, cfg),
    alertaSemVeiculacao: algumaSemVeic,
    diariaPlan: ativas.reduce((t, m) => t + m.diariaPlan, 0),
    media: ativas.reduce((t, m) => t + m.media, 0),
    diariaNecessaria: ativas.reduce((t, m) => t + (m.diariaNecessaria || 0), 0),
    projecaoFim: s('projecaoFim'),
    desvioProjetado: investimento ? s('projecaoFim') / investimento - 1 : null,
    planejadoNoMes: s('planejadoNoMes'), gastoNoMes: s('gastoNoMes'), previstoNoMes: s('previstoNoMes'),
    resultado, resultadosPlan: s('resultadosPlan'), resultadoProjetado: s('resultadoProjetado'),
    pctMeta: s('resultadosPlan') ? s('resultadoProjetado') / s('resultadosPlan') : null,
    custoUnitReal: mesmoKpi && resultado > 0 ? Math.round((gasto / resultado) * (porMil ? 1000 : 1)) : null,
    custoUnitPlan: mesmoKpi && s('resultadosPlan') > 0 ? Math.round((investimento / s('resultadosPlan')) * (porMil ? 1000 : 1)) : null,
    leads: s('leads'), cliques: s('cliques'), impressoes: s('impressoes'),
    inicio: lista.map((m) => m.linha.inicio).sort()[0] || null,
    fim: lista.map((m) => m.linha.fim).sort().at(-1) || null,
  };
}

/** Agrupa métricas por uma função de chave e devolve [{ chave, rotulo, itens, total }]. */
export function agruparPor(lista, chaveFn, rotuloFn = chaveFn, cfg = CONFIG_PADRAO) {
  const m = new Map();
  for (const x of lista) {
    const k = chaveFn(x);
    if (!m.has(k)) m.set(k, { chave: k, rotulo: rotuloFn(x), itens: [] });
    m.get(k).itens.push(x);
  }
  return [...m.values()].map((g) => ({ ...g, total: agregar(g.itens, cfg) }));
}

/**
 * Séries diárias para os gráficos de um conjunto de linhas.
 * Acumulado planejado (ideal), realizado, projeção e faixa de tolerância; diário; resultados.
 */
export function series(listaMetricas, ref, cfg = CONFIG_PADRAO) {
  if (!listaMetricas.length) return null;
  const ini = listaMetricas.map((m) => m.linha.inicio).sort()[0];
  const fim = listaMetricas.map((m) => m.linha.fim).sort().at(-1);
  const ontem = addDias(ref, -1);
  const datas = intervalo(ini, fim);
  let accPlan = 0, accReal = 0, accProj = 0, accResPlan = 0, accRes = 0;
  const out = { datas, planejadoAcum: [], realizadoAcum: [], projecaoAcum: [], faixaMin: [], faixaMax: [],
    gastoDiario: [], diariaPlan: [], diariaNecessaria: [], resultadoAcum: [], resultadoPlanAcum: [], ref, ontem };
  for (const d of datas) {
    let planDia = 0, realDia = 0, necDia = 0, taxaDia = 0, resPlanDia = 0, resDia = 0;
    for (const m of listaMetricas) {
      const l = m.linha;
      if (d < l.inicio || d > l.fim) continue;
      planDia += m.diariaPlan;
      resPlanDia += (l.resultadosPlan || 0) / (l.dias || 1);
      const pd = m.porDia.get(d);
      if (pd && d <= ontem) { realDia += pd.gasto; resDia += pd.resultado; }
      if (d >= ref) {
        necDia += m.diariaNecessaria || 0;
        taxaDia += m.situacao === 'agendada' ? m.diariaPlan : m.media;
      }
    }
    accPlan += planDia;
    accResPlan += resPlanDia;
    out.planejadoAcum.push(accPlan);
    out.faixaMin.push(Math.round(accPlan * (1 - cfg.status.noRitmo)));
    out.faixaMax.push(Math.round(accPlan * (1 + cfg.status.noRitmo)));
    out.diariaPlan.push(planDia);
    out.resultadoPlanAcum.push(Math.round(accResPlan));
    if (d <= ontem) {
      accReal += realDia; accRes += resDia;
      out.realizadoAcum.push(accReal);
      out.resultadoAcum.push(Math.round(accRes));
      out.gastoDiario.push(realDia);
      out.projecaoAcum.push(d === ontem ? accReal : null);
      out.diariaNecessaria.push(null);
      accProj = accReal;
    } else {
      out.realizadoAcum.push(null);
      out.resultadoAcum.push(null);
      out.gastoDiario.push(null);
      accProj += taxaDia;
      out.projecaoAcum.push(accProj);
      out.diariaNecessaria.push(necDia || null);
    }
  }
  // projeção começa em ontem (ponto de conexão) — se ontem < início, começa no primeiro dia
  if (ontem < ini) out.projecaoAcum[0] = out.projecaoAcum[0] ?? 0;
  return out;
}

/**
 * Agrupa linhas em TURMAS: linhas do mesmo produto e praça que compartilham algum código
 * de turma ficam juntas (union-find). Linhas sem código agrupam por produto + praça.
 */
export function chavesDeTurma(linhas) {
  const pai = new Map(linhas.map((l) => [l.id, l.id]));
  const raiz = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
  const unir = (a, b) => pai.set(raiz(a), raiz(b));
  const dono = new Map();
  for (const l of linhas) {
    const chaves = l.codigosTurma.length ? l.codigosTurma.map((c) => `${l.produto}|${l.praca}|${c}`) : [`${l.produto}|${l.praca}|${l.tipoCodigo}`];
    for (const k of chaves) { if (dono.has(k)) unir(l.id, dono.get(k)); else dono.set(k, l.id); }
  }
  const grupos = new Map();
  for (const l of linhas) {
    const r = raiz(l.id);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(l);
  }
  const out = new Map();
  for (const lista of grupos.values()) {
    const codigos = [...new Set(lista.flatMap((l) => l.codigosTurma))].sort();
    const base = lista[0];
    const rotulo = `${base.produto} · ${base.praca} · ${codigos.length ? codigos.join(' + ') : base.codigoRaw || 'sem código'}`;
    const chave = `${base.produto}|${base.praca}|${codigos.join('+') || base.tipoCodigo}`;
    const datas = lista.map((l) => l.dataTurmaInicio).filter(Boolean).sort();
    for (const l of lista) out.set(l.id, { chave, rotulo, dataTurma: datas[0] || null });
  }
  return out;
}

/** Calcula tudo de uma vez para um conjunto de linhas. */
export function calcularTudo(linhas, alocacoes, ref, cfg = CONFIG_PADRAO) {
  const idx = indexarAlocacoes(alocacoes);
  const metricas = linhas.map((l) => metricasLinha(l, idx.get(l.id) || [], ref, cfg));
  return { metricas, total: agregar(metricas, cfg) };
}
