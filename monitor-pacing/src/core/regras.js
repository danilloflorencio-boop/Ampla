// Motor de regras de alertas e recomendações — sem IA, 100% determinístico.
// Cada alerta traz ENTIDADE, NÚMEROS, AÇÃO e PRAZO. Catálogo e racional: docs/REGRAS.md.
// Textos: src/config/textos.js. Limiares: src/config/config.js.

import { brl, pct, decimal, inteiro, dataCurta, addDias, diffDias, minData } from './format.js';
import { CONFIG_PADRAO, configPlataforma } from '../config/config.js';
import { t } from '../config/textos.js';
import { rotuloLinha, rotuloCurto } from './plano.js';
import { chaveEntidade } from './realizado.js';

const SEV = { critico: 3, atencao: 2, info: 1 };
const variacao = (real, plano) => (plano ? `${real >= plano ? '+' : ''}${pct(real / plano - 1)}` : '—');

function nomeEntidade(chave, nomes) {
  const n = nomes.get(chave);
  if (!n) return chave.split('|').slice(-1)[0] || chave;
  return n.conjuntoNome || n.campanhaNome || n.conjuntoId || chave;
}

function alerta(regra, severidade, entidade, vars, extras = {}) {
  return {
    id: `${regra}:${entidade.id}`,
    regra,
    severidade,
    peso: SEV[severidade],
    entidade,
    titulo: t(regra, 'titulo', { entidade: entidade.rotulo, ...vars }),
    mensagem: extras.mensagem ?? t(regra, 'mensagem', { entidade: entidade.rotulo, ...vars }),
    acao: extras.acao ?? t(regra, 'acao', { entidade: entidade.rotulo, ...vars }),
    complemento: extras.complemento || null,
    valores: extras.valores || {},
  };
}

/**
 * Avalia todas as regras.
 * @param {object} ctx
 *  metricas: métricas por linha (pacing.metricasLinha)
 *  flights: flights do plano
 *  registros: realizado canônico (bruto, por conjunto)
 *  orfaos, foraDoPeriodo: saídas de alocarRealizado
 *  vinculos, sugestoes, nomes (Map chave → entidade), justificativas (Record linhaId → texto)
 *  ref, ultimaExtracao, cfg
 */
/**
 * Os dados do realizado estão em dia? Desatualizado quando falta o dia anterior a ontem ou a
 * extração tem mais de `dadosDesatualizadosHoras`. Sem registro nenhum também conta como desatualizado.
 * É a mesma condição que dispara a R13 e suspende as regras de ritmo (e os avisos do chat).
 */
export function frescorDosDados(registros, ext, ref, cfg = CONFIG_PADRAO) {
  if (!registros?.length) return { desatualizado: true, ultimoDiaDados: null };
  const ontem = addDias(ref, -1);
  const ultimoDiaDados = registros.reduce((m, r) => (r.data > m ? r.data : m), '0000');
  const extData = ext ? ext.slice(0, 10) : ultimoDiaDados;
  const horas = ext && ext.length > 10 ? (new Date(`${ref}T12:00:00-03:00`) - new Date(ext)) / 36e5 : diffDias(extData, ref) * 24;
  return { desatualizado: ultimoDiaDados < addDias(ontem, -1) || horas > cfg.regras.dadosDesatualizadosHoras, ultimoDiaDados };
}

export function avaliarRegras(ctx) {
  const cfg = ctx.cfg || CONFIG_PADRAO;
  const R = cfg.regras;
  const ref = ctx.ref;
  const ontem = addDias(ref, -1);
  const nomes = ctx.nomes || new Map();
  const out = [];

  // ---------- R13: dados desatualizados (suspende ritmo e custo) ----------
  let suspenso = false;
  if (ctx.registros?.length) {
    const ext = ctx.ultimaExtracao;
    const { desatualizado, ultimoDiaDados } = frescorDosDados(ctx.registros, ext, ref, cfg);
    if (desatualizado) {
      suspenso = true;
      out.push(alerta('R13', 'critico', { tipo: 'cliente', id: 'dados', rotulo: 'Dados' },
        { extracao: ext ? ext.replace('T', ' ').slice(0, 16) : `dados até ${dataCurta(ultimoDiaDados)}`, ontem: dataCurta(ontem) }));
    }
  }

  const porLinha = new Map(ctx.metricas.map((m) => [m.linhaId, m]));
  const entLinha = (m) => ({ tipo: 'linha', id: m.linhaId, rotulo: rotuloLinha(m.linha) });

  for (const m of ctx.metricas) {
    const l = m.linha;
    const ent = entLinha(m);
    const fim = dataCurta(l.fim);

    // ---------- R04: sem veiculação ----------
    if (m.status.codigo === 'sem-veiculacao') {
      out.push(alerta('R04', 'critico', ent, {
        inicio: dataCurta(l.inicio), dias: m.diasDecorridos, setup: cfg.diasSetup,
        codigo: l.codigoRaw || '—', necessaria: brl(m.diariaNecessaria ?? m.diariaPlan), fim,
      }));
      continue;
    }
    if (m.situacao === 'agendada') continue;

    // ---------- R14: desvio > ±10% sem justificativa ----------
    const desvio = (m.indiceStatus ?? 1) - 1;
    if (Math.abs(desvio) > cfg.status.noRitmo && !ctx.justificativas?.[m.linhaId]) {
      const base = m.situacao === 'encerrada' ? m.investimento : m.planejadoAteOntem;
      const dif = m.gasto - base;
      out.push(alerta('R14', 'info', ent, { desvio: `${desvio > 0 ? '+' : ''}${pct(desvio)}`, valor: `${dif > 0 ? '+' : '−'}${brl(Math.abs(dif))}` }));
    }

    // ---------- R05b: veiculando depois do início da turma ----------
    if (l.dataTurmaInicio) {
      let gastoApos = 0;
      for (const [d, v] of m.porDia) if (d >= l.dataTurmaInicio) gastoApos += v.gasto;
      if (gastoApos > 0) {
        out.push(alerta('R05b', 'atencao', ent, { turma: dataCurta(l.dataTurmaInicio), gasto: brl(gastoApos), saldo: brl(Math.max(0, m.saldo)) }));
      }
    }

    if (suspenso || m.situacao !== 'ativa') continue;
    const janela = Math.min(cfg.janelaMediaDias, m.diasDecorridos);

    // ---------- R01 / R02 / R03: ritmo ----------
    const cod = m.status.codigo;
    if (cod.endsWith('under')) {
      const aumento = m.media > 0 ? m.diariaNecessaria / m.media - 1 : null;
      const vars = {
        gasto: brl(m.gasto), planejado: brl(m.planejadoAteOntem), indice: decimal(m.indice), janela,
        media: brl(m.media), diaria: brl(m.diariaPlan), necessaria: brl(m.diariaNecessaria),
        aumento: aumento === null ? '—' : pct(aumento), dias: m.diasRestantes, fim, investimento: brl(l.investimento),
        passo: brl(Math.round(m.media * (1 + R.catchUpArriscado))),
        fechamento: brl(m.gasto + Math.round(m.media * (1 + R.catchUpArriscado)) * m.diasRestantes),
      };
      const parado = m.media === 0;
      const arriscado = aumento !== null && aumento > R.catchUpArriscado;
      out.push(alerta('R01', cod.startsWith('critico') ? 'critico' : 'atencao', ent, vars, {
        acao: parado ? t('R01', 'acaoParado', vars) : t('R01', 'acao', vars),
        complemento: arriscado ? t('R01', 'catchUp', vars) : null,
        valores: { diariaNecessaria: m.diariaNecessaria, media: m.media },
      }));
    } else if (cod.endsWith('over')) {
      const esgotada = m.saldo <= 0;
      const diasAntes = m.dataEsgotamento ? diffDias(m.dataEsgotamento, l.fim) : 0;
      const vars = {
        gasto: brl(m.gasto), planejado: brl(m.planejadoAteOntem), indice: decimal(m.indice), media: brl(m.media),
        esgota: m.dataEsgotamento ? dataCurta(m.dataEsgotamento) : 'já esgotada', diasAntes: Math.max(0, diasAntes), fim,
        necessaria: brl(m.diariaNecessaria), reducao: m.media ? pct(m.diariaNecessaria / m.media - 1) : '—',
        investimento: brl(l.investimento), excedente: brl(Math.max(0, -m.saldo)),
      };
      out.push(alerta('R02', cod.startsWith('critico') || esgotada ? 'critico' : 'atencao', ent, vars, {
        mensagem: esgotada ? t('R02', 'mensagemEsgotada', vars) : undefined,
        acao: esgotada ? t('R02', 'acaoEsgotada', vars) : t('R02', 'acao', vars),
        valores: { diariaNecessaria: m.diariaNecessaria, media: m.media },
      }));
    } else if (m.dataEsgotamento && m.dataEsgotamento < l.fim) {
      out.push(alerta('R03', 'atencao', ent, {
        indice: decimal(m.indice), janela, media: brl(m.media), esgota: dataCurta(m.dataEsgotamento), fim, necessaria: brl(m.diariaNecessaria),
      }));
    }

    // ---------- R06: custo acima do plano ----------
    const temVolume = m.diasDecorridos >= R.minDiasParaCusto && m.resultado >= R.minResultadosParaCusto;
    if (temVolume && m.custoUnitReal && m.custoUnitPlan && m.custoUnitReal > m.custoUnitPlan * (1 + R.custoAcimaDoPlano)) {
      const top = m.entidades[0];
      const custoTop = top && top.resultado ? Math.round(top.gasto / top.resultado) : null;
      const vars = {
        kpi: m.kpi, custoReal: brl(m.custoUnitReal), custoPlan: brl(m.custoUnitPlan),
        variacao: variacao(m.custoUnitReal, m.custoUnitPlan), projetado: inteiro(m.resultadoProjetado),
        plano: inteiro(m.resultadosPlan), rotulo: m.rotuloResultado,
        conjunto: top ? nomeEntidade(top.chave, nomes) : '—', pctConjunto: top && m.gasto ? pct(top.gasto / m.gasto) : '—',
        custoConjunto: custoTop ? brl(custoTop) : '—',
      };
      out.push(alerta('R06', 'atencao', ent, vars, { acao: top ? t('R06', 'acao', vars) : '' }));
    }

    // ---------- R07: resultado projetado abaixo do plano ----------
    if (temVolume && m.pctMeta !== null && m.pctMeta < R.metaProjetadaMinima && m.custoUnitReal) {
      const falta = Math.max(0, m.resultadosPlan - m.resultadoProjetado);
      const verbaExtra = Math.round(falta * m.custoUnitReal / (m.kpi === 'CPM' ? 1000 : 1));
      out.push(alerta('R07', 'atencao', ent, {
        projetado: inteiro(m.resultadoProjetado), plano: inteiro(m.resultadosPlan), rotulo: m.rotuloResultado,
        pctMeta: pct(m.pctMeta), custoReal: brl(m.custoUnitReal), verbaExtra: brl(verbaExtra),
      }));
    }

    // ---------- R09: concentração em um conjunto ----------
    if (m.entidades.length >= 2 && m.gasto > 0) {
      const top = m.entidades[0];
      const recentes = new Set([0, 1, 2].map((i) => addDias(ontem, -i)));
      const parados = m.entidades.slice(1).filter((e) => {
        let g = 0;
        for (const a of ctx.alocacoesPorLinha?.get(m.linhaId) || []) if (a.chave === e.chave && recentes.has(a.data)) g += a.gasto;
        return g === 0;
      });
      if (top.gasto / m.gasto > R.concentracaoConjunto && parados.length) {
        out.push(alerta('R09', 'info', ent, {
          conjunto: nomeEntidade(top.chave, nomes), pct: pct(top.gasto / m.gasto), parados: parados.length,
          listaParados: parados.map((e) => nomeEntidade(e.chave, nomes)).join(', '), necessaria: brl(m.diariaNecessaria),
        }));
      }
    }

    // ---------- R10: picos diários contra a diária planejada ----------
    const limite = Math.round(m.diariaPlan * (1 + R.picoDiarioVsPlano));
    let picos = 0, pico = 0, dataPico = null;
    for (let i = 0; i < janela; i++) {
      const d = addDias(minData(ontem, l.fim), -i);
      const g = m.porDia.get(d)?.gasto || 0;
      if (g > limite) picos++;
      if (g > pico) { pico = g; dataPico = d; }
    }
    if (picos >= R.diasPicoParaAlerta) {
      const plat = configPlataforma(l.plataforma);
      out.push(alerta('R10', 'atencao', ent, {
        dias: picos, limite: brl(limite), diaria: brl(m.diariaPlan), pico: brl(pico), dataPico: dataCurta(dataPico),
        alavanca: `${plat.alavancas[0]}: ${brl(Math.max(0, m.saldo))} com término em ${fim}.`,
      }));
    }
  }

  // ---------- R11 / R11u / R15: comportamento da plataforma por conjunto ----------
  if (!suspenso && ctx.registros?.length) {
    const porEnt = new Map();
    for (const r of ctx.registros) {
      if (r.data >= ref) continue;
      const k = chaveEntidade(r);
      if (!porEnt.has(k)) porEnt.set(k, []);
      porEnt.get(k).push(r);
    }
    const ultimos7 = new Set([...Array(7)].map((_, i) => addDias(ontem, -i)));
    // dias restantes considerando só as linhas vinculadas que ainda estão ativas
    const diasFlightPorLinha = (ids) => Math.max(0, ...ids.map((id) => porLinha.get(id)).filter((m) => m && m.situacao === 'ativa').map((m) => m.diasRestantes));
    for (const [chave, regs] of porEnt) {
      const recentes = regs.filter((r) => ultimos7.has(r.data) && r.orcamentoDiario);
      if (!recentes.length) continue;
      const v = ctx.vinculos?.[chave];
      const plat = configPlataforma(regs[0].plataforma);
      const nome = nomeEntidade(chave, nomes);
      const ent = { tipo: 'conjunto', id: chave, rotulo: nome };
      // over-delivery
      const acima = recentes.filter((r) => r.gasto > r.orcamentoDiario * 1.05);
      if (acima.length >= 2) {
        const maior = acima.reduce((a, b) => (b.gasto / b.orcamentoDiario > a.gasto / a.orcamentoDiario ? b : a));
        const excesso = maior.gasto / maior.orcamentoDiario - 1;
        const dentroDoPermitido = plat.overDiarioMax !== null && excesso <= plat.overDiarioMax;
        const restantes = v?.linhas?.length ? diasFlightPorLinha(v.linhas) : 99;
        if (v?.linhas?.length && restantes === 0) continue; // linhas encerradas: o gasto fora do período já é tratado no R05
        let comportamento = plat.overDiarioMax === null
          ? `Limites de entrega de ${plat.nome} ainda não validados na configuração.`
          : dentroDoPermitido
            ? `Dentro do que ${plat.nome} permite em um dia (até ${pct(plat.overDiarioMax, 0)} acima), compensado ${plat.tetoSemanalMultiplo ? 'na semana' : 'no mês'}.`
            : `Acima do que ${plat.nome} costuma permitir em um dia (${pct(plat.overDiarioMax, 0)}): verificar mudanças de orçamento no período.`;
        if (restantes < 7 && dentroDoPermitido) comportamento += ` Restam só ${restantes} dia(s) de flight: a compensação da plataforma pode não acontecer a tempo.`;
        const saldoLinhas = v?.linhas?.reduce((s, id) => s + Math.max(0, porLinha.get(id)?.saldo || 0), 0) ?? null;
        const fimLinhas = v?.linhas?.map((id) => porLinha.get(id)?.linha.fim).filter(Boolean).sort().at(-1);
        const alavanca = saldoLinhas !== null && fimLinhas
          ? `${plat.alavancas[0]} (saldo de ${brl(saldoLinhas)} até ${dataCurta(fimLinhas)}). ${plat.alavancas[1] || ''}`.trim()
          : `Conjunto sem linha no plano: vincular primeiro (R08). Enquanto isso, ${plat.alavancas[0].charAt(0).toLowerCase()}${plat.alavancas[0].slice(1)}, no valor aprovado para ele (hoje configurado em ${brl(maior.orcamentoDiario)}/dia e gastando até ${brl(maior.gasto)}).`;
        out.push(alerta('R11', dentroDoPermitido && restantes >= 7 ? 'info' : 'atencao', ent, {
          dias: acima.length, orcamento: brl(maior.orcamentoDiario), pico: brl(maior.gasto), dataPico: dataCurta(maior.data),
          excesso: pct(excesso), comportamento, alavanca,
        }));
      }
      // under-delivery (entrega limitada)
      const ult3 = recentes.filter((r) => r.data >= addDias(ontem, -2));
      if (ult3.length >= 3) {
        const media = ult3.reduce((s, r) => s + r.gasto, 0) / ult3.length;
        const orc = ult3[ult3.length - 1].orcamentoDiario;
        if (media < orc * 0.5) {
          const ativasE = (v?.linhas || []).map((id) => porLinha.get(id)).filter((m) => m && m.situacao === 'ativa');
          const diasR = ativasE.length ? Math.max(...ativasE.map((m) => m.diasRestantes)) : 0;
          const fimE = ativasE.map((m) => m.linha.fim).sort().at(-1);
          const naoGasto = Math.round(orc - media);
          out.push(alerta('R11u', 'atencao', ent, {
            dias: 3, media: brl(Math.round(media)), pct: pct(media / orc, 0), orcamento: brl(orc),
            naoGasto: brl(naoGasto), sobra: brl(naoGasto * diasR), fim: fimE ? dataCurta(fimE) : 'o fim do flight',
          }));
        }
      }
    }
    // R15: soma das diárias configuradas x diária necessária da linha
    for (const m of ctx.metricas) {
      if (m.situacao !== 'ativa' || !m.diariaNecessaria) continue;
      const ents = m.entidades;
      if (!ents.length) continue;
      let soma = 0, conhecidos = 0;
      for (const e of ents) {
        const regsE = (porEnt.get(e.chave) || []).filter((r) => r.data === ontem && r.orcamentoDiario);
        if (regsE.length) { soma += regsE[0].orcamentoDiario; conhecidos++; }
      }
      if (!conhecidos || conhecidos < ents.length) continue;
      // conjunto compartilhado com outra linha ativa: compara só se este for o único vínculo ativo do conjunto
      const compartilhado = ents.some((e) => (ctx.vinculos?.[e.chave]?.linhas || []).filter((id) => porLinha.get(id)?.situacao === 'ativa').length > 1);
      if (compartilhado) continue;
      const dif = soma / m.diariaNecessaria - 1;
      if (Math.abs(dif) > R.orcamentoDivergente) {
        const detalhe = ents.length > 1 ? ` (soma dos ${ents.length} conjuntos, proporcional ao gasto de cada um)` : ` no conjunto ${nomeEntidade(ents[0].chave, nomes)}`;
        out.push(alerta('R15', Math.abs(dif) > cfg.status.atencao ? 'atencao' : 'info', entLinha(m), {
          configurado: brl(soma), necessaria: brl(m.diariaNecessaria), variacao: `${dif > 0 ? '+' : ''}${pct(dif)}`,
          fim: dataCurta(m.linha.fim), detalhe,
        }, { valores: { configurado: soma, necessaria: m.diariaNecessaria } }));
      }
    }
  }

  // ---------- R12: remanejamento dentro do mesmo flight + produto ----------
  if (!suspenso) {
    const ativas = ctx.metricas.filter((m) => m.situacao === 'ativa' && m.diasRestantes > 0);
    const grupos = new Map();
    for (const m of ativas) {
      const k = cfg.escopoRemanejamento === 'cliente' ? 'todos' : cfg.escopoRemanejamento === 'produto' ? m.linha.produto : `${m.linha.flightId}|${m.linha.produto}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(m);
    }
    for (const lista of grupos.values()) {
      const origens = lista.filter((m) => m.investimento - m.projecaoFim > m.investimento * R.sobraParaRemanejar && m.diasDecorridos >= R.minDiasParaCusto);
      const destinos = lista.filter((m) => m.custoUnitReal && m.custoUnitPlan && m.custoUnitReal <= m.custoUnitPlan
        && m.status.codigo === 'ok' && m.resultado >= R.minResultadosParaCusto).sort((a, b) => a.custoUnitReal / a.custoUnitPlan - b.custoUnitReal / b.custoUnitPlan);
      for (const o of origens) {
        const d = destinos.find((x) => x !== o && x.kpi === o.kpi);
        if (!d) continue;
        const sobra = o.investimento - o.projecaoFim;
        const valor = Math.round(sobra * 0.8);
        const diasComuns = Math.min(o.diasRestantes, d.diasRestantes);
        if (diasComuns <= 0 || valor < 1000) continue;
        const novaOrigem = Math.max(0, Math.round((Math.max(0, o.saldo) - valor) / o.diasRestantes));
        const novaDestino = Math.round((Math.max(0, d.saldo) + valor) / d.diasRestantes);
        const custoOrig = o.custoUnitReal || o.custoUnitPlan;
        const ganho = valor / d.custoUnitReal - (custoOrig ? valor / custoOrig : 0);
        out.push(alerta('R12', 'info', { tipo: 'par', id: `${o.linhaId}>${d.linhaId}`, rotulo: `${rotuloLinha(o.linha)} → ${rotuloLinha(d.linha)}` }, {
          origem: rotuloCurto(o.linha), destino: rotuloCurto(d.linha), sobra: brl(sobra), kpi: d.kpi,
          custoDestino: brl(d.custoUnitReal), variacao: variacao(d.custoUnitReal, d.custoUnitPlan), valor: brl(valor),
          novaOrigem: brl(novaOrigem), novaDestino: brl(novaDestino), fim: dataCurta(minData(o.linha.fim, d.linha.fim)),
          ganho: inteiro(Math.max(0, ganho)), rotulo: d.rotuloResultado,
        }, { valores: { valor, origem: o.linhaId, destino: d.linhaId } }));
      }
    }
  }

  // ---------- R07b: meta de inscritos do briefing por flight (leads) ----------
  if (!suspenso && ctx.flights) {
    for (const f of ctx.flights) {
      if (!f.meta) continue;
      const ms = ctx.metricas.filter((m) => m.linha.flightId === f.id);
      if (!ms.length || ms.every((m) => m.situacao === 'agendada')) continue;
      const leads = ms.reduce((s, m) => s + m.leads, 0);
      const gasto = ms.reduce((s, m) => s + m.gasto, 0);
      if (gasto === 0 || ms.reduce((s, m) => s + m.diasDecorridos, 0) < R.minDiasParaCusto) continue;
      const proj = ms.reduce((s, m) => s + m.projecaoFim, 0);
      const leadsProj = Math.round(leads * (proj / gasto));
      if (leadsProj < f.meta * R.metaProjetadaMinima) {
        const fimF = ms.map((m) => m.linha.fim).sort().at(-1);
        const encerrado = fimF < ref;
        const cpl = leads ? Math.round(gasto / leads) : null;
        const falta = f.meta - leadsProj;
        const vars = {
          projetado: inteiro(leadsProj), meta: inteiro(f.meta), pctMeta: pct(leadsProj / f.meta), leads: inteiro(leads),
          prazo: dataCurta(minData(addDias(ref, 1), fimF)), cpl: brl(cpl), falta: inteiro(falta),
          verba: cpl ? brl(falta * cpl) : '—',
        };
        out.push(alerta('R07b', encerrado ? 'info' : 'atencao', { tipo: 'flight', id: f.id, rotulo: f.aba }, vars,
          { acao: encerrado ? t('R07b', 'acaoEncerrado', vars) : t('R07b', 'acao', vars) }));
      }
    }
  }

  // ---------- R08: gasto órfão ----------
  const orfaosPorEnt = new Map();
  for (const r of ctx.orfaos || []) {
    const k = chaveEntidade(r);
    const o = orfaosPorEnt.get(k) || { gasto: 0, dias: new Set(), primeiro: r.data, ultimo: r.data };
    o.gasto += r.gasto; o.dias.add(r.data);
    if (r.data < o.primeiro) o.primeiro = r.data;
    if (r.data > o.ultimo) o.ultimo = r.data;
    orfaosPorEnt.set(k, o);
  }
  for (const [k, o] of orfaosPorEnt) {
    if (o.gasto <= 0) continue;
    const s = (ctx.sugestoes || []).find((x) => x.chave === k);
    out.push(alerta('R08', 'atencao', { tipo: 'conjunto', id: k, rotulo: nomeEntidade(k, nomes) }, {
      gasto: brl(o.gasto), dias: o.dias.size, primeiro: dataCurta(o.primeiro), ultimo: dataCurta(o.ultimo),
      sugestao: s ? ` (há sugestão de confiança ${({ alta: 'alta', media: 'média', baixa: 'baixa' })[s.confianca]} para ${s.linhas.length} linha(s), por ${s.motivos.join(', ')})` : '',
    }));
  }

  // ---------- R05: gasto fora do período ----------
  const forasPorEnt = new Map();
  for (const r of ctx.foraDoPeriodo || []) {
    const o = forasPorEnt.get(r.chave) || { gasto: 0, dias: new Set(), ultimo: r.data, linhas: r.linhasVinculadas };
    o.gasto += r.gasto; o.dias.add(r.data);
    if (r.data > o.ultimo) o.ultimo = r.data;
    forasPorEnt.set(r.chave, o);
  }
  for (const [k, o] of forasPorEnt) {
    if (o.gasto <= 0) continue;
    const fimLinha = o.linhas.map((id) => porLinha.get(id)?.linha.fim).filter(Boolean).sort().at(-1);
    out.push(alerta('R05', o.ultimo >= addDias(ontem, -2) ? 'atencao' : 'info', { tipo: 'conjunto', id: k, rotulo: nomeEntidade(k, nomes) }, {
      gasto: brl(o.gasto), dias: o.dias.size, ultimo: dataCurta(o.ultimo), fimLinha: dataCurta(fimLinha),
    }));
  }

  return out.sort((a, b) => b.peso - a.peso || a.regra.localeCompare(b.regra));
}

/** Aplica as decisões manuais (aceita / descartada / adiada) aos alertas. */
export function aplicarDecisoes(alertas, decisoes = {}, ref) {
  return alertas.map((a) => {
    const d = decisoes[a.id];
    if (!d) return { ...a, estado: 'aberto' };
    if (d.estado === 'adiada' && d.ate && d.ate <= ref) return { ...a, estado: 'aberto', decisao: d };
    return { ...a, estado: d.estado, decisao: d };
  });
}
