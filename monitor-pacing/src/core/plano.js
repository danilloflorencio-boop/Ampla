// Importador do plano de mídia no formato Ampla ("novo formato").
// Entrada: abas já lidas como matriz de células ([{ nome, linhas: any[][] }]) — independente
// de SheetJS, para rodar igual no navegador e nos testes.
// O VALOR MONITORADO é a coluna "Investimento Plataforma R$". Ela é a fonte da verdade;
// a cascata financeira é recalculada só para conferência (gera aviso, nunca sobrescreve).

import {
  parseNumero, paraCentavos, parsePercentual, parseData, normalizar, extrairCodigosTurma,
  diasInclusivos, addDias, diffDias,
} from './format.js';

const COLUNAS = {
  plataforma: (h) => h === 'PLATAFORMA',
  produto: (h) => h.startsWith('CAMPANHA / PRODUTO') || h === 'CAMPANHA' || h === 'PRODUTO',
  codigo: (h) => h.startsWith('CODIGO DA TURMA') || h === 'CODIGO',
  etapa: (h) => h.startsWith('ETAPA DO FUNIL'),
  objetivo: (h) => h.startsWith('OBJETIVO DA CAMPANHA'),
  formato: (h) => h === 'FORMATO',
  segmentacao: (h) => h.startsWith('SEGMENTACAO'),
  praca: (h) => h === 'PRACA',
  destino: (h) => h.startsWith('DESTINO'),
  dataTurma: (h) => h.startsWith('DATA DA TURMA'),
  inicio: (h) => h.startsWith('INICIO VEICULACAO'),
  fim: (h) => h.startsWith('FIM VEICULACAO'),
  alcanceEst: (h) => h.startsWith('ALCANCE'),
  impressoesEst: (h) => h.startsWith('IMPRESSOES'),
  metrica: (h) => h.startsWith('METRICA'),
  kpi: (h) => h.startsWith('KPI'),
  custoUnit: (h) => h.startsWith('CUSTO UNIT'),
  resultados: (h) => h.startsWith('RESULTADOS EST'),
  brutoCliente: (h) => h.startsWith('VERBA BRUTA CLIENTE'),
  brutoVeiculo: (h) => h.startsWith('BRUTO VEICULO'),
  liquida: (h) => h.startsWith('VERBA LIQUIDA'),
  investimento: (h) => h.startsWith('INVESTIMENTO PLATAFORMA'),
  diaria: (h) => h.startsWith('VERBA DIARIA'),
  pctPlano: (h) => h.startsWith('% DO PLANO'),
  observacoes: (h) => h.startsWith('OBSERVACOES PI'),
};
const OBRIGATORIAS = ['plataforma', 'investimento', 'inicio', 'fim'];

const ROTULOS = {
  divisorBrutoVeiculo: 'BRUTO VEICULO = BRUTO CLIENTE',
  comissao: 'COMISSAO SOBRE BRUTO VEICULO',
  descontoPlataforma: 'DESCONTO P/ INVESTIMENTO EM PLATAFORMA',
  connectRate: 'CONNECT RATE',
  conversao: 'CONVERSAO (SESSOES',
  cpcMedio: 'CPC MEDIO ESTIMADO',
  campanhaEvento: 'CAMPANHA / EVENTO',
  dataEvento: 'DATA DO EVENTO',
  periodo: 'PERIODO DE VEICULACAO',
  target: 'TARGET',
  verbaBruta: 'VERBA BRUTA (CLIENTE)',
  objetivoPrimario: 'OBJETIVO PRIMARIO',
  meta: 'META DE INSCRITOS',
};

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';
const texto = (v) => (vazio(v) ? '' : String(v).trim());
const slug = (s) => normalizar(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Primeiro valor não vazio à direita de uma célula cujo texto começa com o rótulo. */
function valorDoRotulo(linhas, rotulo, ateLinha) {
  for (let r = 0; r < Math.min(linhas.length, ateLinha); r++) {
    const row = linhas[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (normalizar(row[c]).startsWith(rotulo)) {
        for (let k = c + 1; k < row.length; k++) if (!vazio(row[k])) return row[k];
        return null;
      }
    }
  }
  return null;
}

function lerCabecalho(linhas) {
  for (let r = 0; r < Math.min(6, linhas.length); r++) {
    for (const cel of linhas[r] || []) {
      const s = texto(cel);
      if (/cliente\s*:/i.test(s)) {
        const pega = (re) => (s.match(re) || [])[1]?.trim() || null;
        return {
          cliente: pega(/Cliente:\s*(.+?)\s*(·|$)/i),
          veiculo: pega(/Ve[ií]culo:\s*(.+?)\s*(·|$)/i),
          inicio: parseData(pega(/Veicula[cç][aã]o:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)),
          fim: parseData(pega(/Veicula[cç][aã]o:\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*a\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)),
          verbaBruta: paraCentavos(pega(/Verba bruta:\s*(R\$\s*[\d.,]+)/i)),
        };
      }
    }
  }
  return {};
}

/** "19 e 20 \n26 e 27/10" → ['2026-10-19', …]. Usa o ano do início da veiculação. */
export function datasDaTurma(textoTurma, inicioVeiculacao) {
  if (vazio(textoTurma) || !inicioVeiculacao) return [];
  const limpo = String(textoTurma)
    .replace(/\d+\s*[ªº]\s*(turma)?/gi, ' ')
    .replace(/turma\s*\d+\s*[-–:]/gi, ' ')
    .replace(/\([^)]*\)/g, ' ');
  const tokens = limpo.match(/\d{1,2}(\/\d{1,2})?/g) || [];
  const ano = Number(inicioVeiculacao.slice(0, 4));
  const datas = [];
  let mes = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const [d, m] = tokens[i].split('/');
    if (m) mes = Number(m);
    if (!mes) continue;
    const dia = Number(d);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    let iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (diffDias(iso, inicioVeiculacao) > 60) iso = `${ano + 1}${iso.slice(4)}`;
    datas.unshift(iso);
  }
  return [...new Set(datas)].sort();
}

function tipoCodigo(raw, codigos) {
  const n = normalizar(raw);
  if (n.includes('EXTRA')) return 'extra';
  if (n.includes('DISPONIVEL') || !n) return 'indisponivel';
  return codigos.length > 1 ? 'multi' : codigos.length === 1 ? 'turma' : 'outro';
}

const KPI_POR_METRICA = {
  LEADS: ['CPL', 'CPA'], CONVERSAO: ['CPA', 'CPL'], CLIQUES: ['CPC'], TRAFEGO: ['CPC'],
  ALCANCE: ['CPM'], IMPRESSOES: ['CPM'], VIDEO: ['CPV'], VISUALIZACOES: ['CPV'], ENGAJAMENTO: ['CPE'],
};
function kpiCoerente(metrica, kpi) {
  const m = normalizar(metrica);
  const chave = Object.keys(KPI_POR_METRICA).find((k) => m.includes(k));
  if (!chave || !kpi) return true;
  return KPI_POR_METRICA[chave].includes(normalizar(kpi));
}

function lerAba(aba, avisos) {
  const linhas = aba.linhas || [];
  const aviso = (codigo, severidade, mensagem, extra = {}) =>
    avisos.push({ codigo, severidade, aba: aba.nome, mensagem, ...extra });

  // 1) localizar a linha de cabeçalho da tabela PLANO DE MÍDIA
  let rh = -1;
  for (let r = 0; r < linhas.length; r++) {
    const ns = (linhas[r] || []).map(normalizar);
    if (ns.includes('PLATAFORMA') && ns.some((h) => h.startsWith('INVESTIMENTO PLATAFORMA'))) { rh = r; break; }
  }
  if (rh < 0) {
    aviso('ABA_IGNORADA', 'info', 'Aba sem a tabela "PLANO DE MÍDIA" com a coluna "Investimento Plataforma R$" — ignorada.');
    return null;
  }
  const cab = (linhas[rh] || []).map(normalizar);
  const col = {};
  for (const [campo, teste] of Object.entries(COLUNAS)) {
    const idx = cab.findIndex((h) => h && teste(h));
    if (idx >= 0) col[campo] = idx;
  }
  const faltando = OBRIGATORIAS.filter((c) => col[c] === undefined);
  if (faltando.length) {
    aviso('COLUNAS_FALTANDO', 'critico', `Colunas obrigatórias ausentes: ${faltando.join(', ')}. Aba ignorada.`);
    return null;
  }

  const cabecalho = lerCabecalho(linhas);
  const v = (r, campo) => (col[campo] === undefined ? null : (linhas[r] || [])[col[campo]]);
  const params = {
    divisorBrutoVeiculo: parsePercentual(valorDoRotulo(linhas, ROTULOS.divisorBrutoVeiculo, rh)),
    comissao: parsePercentual(valorDoRotulo(linhas, ROTULOS.comissao, rh)),
    descontoPlataforma: parsePercentual(valorDoRotulo(linhas, ROTULOS.descontoPlataforma, rh)),
    connectRate: parsePercentual(valorDoRotulo(linhas, ROTULOS.connectRate, rh)),
    conversao: parsePercentual(valorDoRotulo(linhas, ROTULOS.conversao, rh)),
    cpcMedio: paraCentavos(valorDoRotulo(linhas, ROTULOS.cpcMedio, rh)),
  };
  const flightId = slug(aba.nome);
  const flight = {
    id: flightId,
    aba: aba.nome,
    cliente: cabecalho.cliente,
    veiculo: cabecalho.veiculo,
    inicio: cabecalho.inicio,
    fim: cabecalho.fim,
    verbaBruta: cabecalho.verbaBruta ?? paraCentavos(valorDoRotulo(linhas, ROTULOS.verbaBruta, rh)),
    meta: parseNumero(valorDoRotulo(linhas, ROTULOS.meta, rh)),
    objetivoPrimario: texto(valorDoRotulo(linhas, ROTULOS.objetivoPrimario, rh)),
    campanhaEvento: texto(valorDoRotulo(linhas, ROTULOS.campanhaEvento, rh)),
    target: texto(valorDoRotulo(linhas, ROTULOS.target, rh)),
    params,
    totaisPlanilha: null,
    linhaIds: [],
  };
  if (!flight.inicio || !flight.fim) {
    const p = texto(valorDoRotulo(linhas, ROTULOS.periodo, rh)).split(/\s+a\s+/i);
    flight.inicio = flight.inicio || parseData(p[0]);
    flight.fim = flight.fim || parseData(p[1]);
  }

  // 2) linhas do plano até "TOTAL DO PLANO"
  const itens = [];
  let rTotal = -1;
  for (let r = rh + 1; r < linhas.length; r++) {
    const primeira = normalizar((linhas[r] || [])[0]);
    if (primeira.startsWith('TOTAL DO PLANO')) { rTotal = r; break; }
    if (primeira.startsWith('RESUMO POR PLATAFORMA')) break;
    const plataforma = texto(v(r, 'plataforma'));
    const invest = paraCentavos(v(r, 'investimento'));
    if (!plataforma || invest === null) continue;
    const linhaPlanilha = r + 1;
    const inicio = parseData(v(r, 'inicio'));
    const fim = parseData(v(r, 'fim'));
    const codigoRaw = texto(v(r, 'codigo'));
    const codigos = extrairCodigosTurma(codigoRaw);
    const turmaTexto = texto(v(r, 'dataTurma'));
    const datasTurma = datasDaTurma(turmaTexto, inicio);
    const item = {
      id: `${flightId}:L${linhaPlanilha}`,
      flightId,
      aba: aba.nome,
      linhaPlanilha,
      plataforma: plataforma.toUpperCase(),
      produto: texto(v(r, 'produto')).toUpperCase(),
      codigoRaw,
      codigosTurma: codigos,
      tipoCodigo: tipoCodigo(codigoRaw, codigos),
      etapa: texto(v(r, 'etapa')),
      objetivo: texto(v(r, 'objetivo')),
      formato: texto(v(r, 'formato')),
      segmentacao: texto(v(r, 'segmentacao')),
      praca: texto(v(r, 'praca')).toUpperCase(),
      destino: texto(v(r, 'destino')),
      dataTurmaTexto: turmaTexto,
      dataTurmaInicio: datasTurma[0] || null,
      dataTurmaFim: datasTurma[datasTurma.length - 1] || null,
      inicio,
      fim,
      dias: inicio && fim ? diasInclusivos(inicio, fim) : 0,
      metrica: texto(v(r, 'metrica')).toUpperCase(),
      kpi: texto(v(r, 'kpi')).toUpperCase(),
      custoUnitPlan: paraCentavos(v(r, 'custoUnit')),
      resultadosPlan: parseNumero(v(r, 'resultados')),
      brutoCliente: paraCentavos(v(r, 'brutoCliente')),
      brutoVeiculo: paraCentavos(v(r, 'brutoVeiculo')),
      liquida: paraCentavos(v(r, 'liquida')),
      investimento: invest, // ← VALOR MONITORADO
      diariaPlanilha: paraCentavos(v(r, 'diaria')),
      pctPlanoPlanilha: parsePercentual(v(r, 'pctPlano')),
      observacoes: texto(v(r, 'observacoes')),
    };
    item.diariaPlan = item.dias ? Math.round(item.investimento / item.dias) : null;
    itens.push(item);
  }
  if (rTotal >= 0) {
    flight.totaisPlanilha = {
      investimento: paraCentavos(v(rTotal, 'investimento')),
      brutoCliente: paraCentavos(v(rTotal, 'brutoCliente')),
      pctPlano: parsePercentual(v(rTotal, 'pctPlano')),
      resultados: parseNumero(v(rTotal, 'resultados')),
    };
  }

  // 3) resumo por plataforma (só conferência)
  const resumo = {};
  for (let r = Math.max(rTotal, rh); r < linhas.length; r++) {
    if (!normalizar((linhas[r] || [])[0]).startsWith('RESUMO POR PLATAFORMA')) continue;
    const head = (linhas[r + 1] || []).map(normalizar);
    const ci = head.findIndex((h) => h.startsWith('INVEST'));
    for (let k = r + 2; k < Math.min(r + 12, linhas.length); k++) {
      const nome = normalizar((linhas[k] || [])[0]);
      if (!nome || nome === 'TOTAL' || nome.startsWith('PLATAFORMAS FORA')) break;
      if (ci >= 0) resumo[nome] = paraCentavos((linhas[k] || [])[ci]);
    }
    break;
  }
  flight.resumoPlanilha = resumo;
  if (!flight.inicio && itens.length) flight.inicio = itens.map((i) => i.inicio).sort()[0];
  if (!flight.fim && itens.length) flight.fim = itens.map((i) => i.fim).sort().at(-1);
  flight.inicioEfetivo = itens.map((i) => i.inicio).filter(Boolean).sort()[0] || flight.inicio;
  flight.fimEfetivo = itens.map((i) => i.fim).filter(Boolean).sort().at(-1) || flight.fim;
  flight.linhaIds = itens.map((i) => i.id);
  flight.investimento = itens.reduce((s, i) => s + i.investimento, 0);

  validarAba(flight, itens, aviso);
  return { flight, itens };
}

function validarAba(flight, itens, aviso) {
  const p = flight.params;
  const totalInvest = flight.investimento;
  let avisouRotulo12 = false;
  const conflitosKpi = {};
  const semUtm = [];
  for (const i of itens) {
    const ref = { linhaId: i.id, linhaPlanilha: i.linhaPlanilha };
    const nomeLinha = `${i.produto} ${i.codigoRaw.replace(/\s+/g, ' ')} ${i.praca}`.trim();
    if (!i.inicio || !i.fim) aviso('DATA_INVALIDA', 'critico', `Linha ${i.linhaPlanilha} (${nomeLinha}): início ou fim da veiculação inválido.`, ref);
    // V1 — período da linha fora do cabeçalho da aba
    if (flight.inicio && flight.fim && i.inicio && i.fim && (i.inicio < flight.inicio || i.fim > flight.fim)) {
      aviso('V1_PERIODO_FORA_DA_ABA', 'atencao',
        `Linha ${i.linhaPlanilha} (${nomeLinha}) veicula de ${i.inicio} a ${i.fim}, fora do período do cabeçalho (${flight.inicio} a ${flight.fim}). O monitor usa o período da linha.`, ref);
    }
    // V4 — métrica x KPI
    if (!kpiCoerente(i.metrica, i.kpi)) (conflitosKpi[`${i.metrica}|${i.kpi}`] ||= []).push(i.linhaPlanilha);
    // V5 — destino/UTM vazio
    if (!i.destino) semUtm.push(i.linhaPlanilha);
    // V7 — veiculação depois do início da turma
    if (i.dataTurmaInicio && i.fim && i.fim > i.dataTurmaInicio) {
      aviso('V7_VEICULA_APOS_TURMA', 'atencao', `Linha ${i.linhaPlanilha} (${nomeLinha}): veiculação termina em ${i.fim}, depois do início da turma (${i.dataTurmaInicio}).`, ref);
    }
    // V10 — cascata financeira (só conferência; a coluna monitorada prevalece)
    if (i.brutoCliente !== null && p.divisorBrutoVeiculo && p.comissao !== null && p.descontoPlataforma !== null) {
      const calc = Math.round((i.brutoCliente / p.divisorBrutoVeiculo) * (1 - p.comissao) * (1 - p.descontoPlataforma));
      if (Math.abs(calc - i.investimento) > 5) {
        aviso('V10_CASCATA', 'info', `Linha ${i.linhaPlanilha} (${nomeLinha}): Investimento Plataforma da planilha difere da cascata recalculada em ${((i.investimento - calc) / 100).toFixed(2)} reais. Vale a coluna da planilha.`, ref);
      }
    }
    // V11 — verba diária da planilha x investimento ÷ dias
    if (i.diariaPlanilha !== null && i.diariaPlan !== null && Math.abs(i.diariaPlanilha - i.diariaPlan) > 5) {
      aviso('V11_DIARIA', 'info', `Linha ${i.linhaPlanilha} (${nomeLinha}): verba diária da planilha (${(i.diariaPlanilha / 100).toFixed(2)}) ≠ investimento ÷ ${i.dias} dias (${(i.diariaPlan / 100).toFixed(2)}).`, ref);
    }
    // V12 — resultados estimados x investimento ÷ custo unitário
    if (i.custoUnitPlan && i.resultadosPlan) {
      const fator = i.kpi === 'CPM' ? 1000 : 1;
      const esperado = (i.investimento / i.custoUnitPlan) * fator;
      if (Math.abs(esperado - i.resultadosPlan) / i.resultadosPlan > 0.03) {
        aviso('V12_RESULTADO_EST', 'info', `Linha ${i.linhaPlanilha} (${nomeLinha}): resultados estimados (${i.resultadosPlan}) ≠ investimento ÷ custo unitário (${Math.round(esperado)}).`, ref);
      }
    }
    // V13 — código da turma
    if (i.tipoCodigo === 'indisponivel') aviso('V13_SEM_CODIGO', 'atencao', `Linha ${i.linhaPlanilha} (${i.produto} ${i.praca}): código da turma "${i.codigoRaw || 'vazio'}". Sem código, a vinculação automática fica mais fraca — peça o código ao atendimento.`, ref);
    // % do plano zerado com investimento
    if (i.pctPlanoPlanilha === 0 && i.investimento > 0) {
      aviso('V2_PCT_ZERADO', 'atencao', `Linha ${i.linhaPlanilha} (${nomeLinha}): "% do Plano" = 0,0% com investimento de ${(i.investimento / 100).toFixed(2)} reais (fórmula quebrada na planilha).`, ref);
    }
    if (!avisouRotulo12 && /l[ií]quida\s*\+\s*12/i.test(i.observacoes)) {
      avisouRotulo12 = true;
      aviso('ROTULO_MAIS_12', 'info', 'As Observações PI dizem "Verba líquida + 12%", mas o valor "Meta" é o Investimento Plataforma (líquida − 12,15%). Revisar o rótulo do modelo.');
    }
  }
  for (const [par, lns] of Object.entries(conflitosKpi)) {
    const [metrica, kpi] = par.split('|');
    aviso('V4_METRICA_KPI', 'info',
      `${lns.length} linha(s) com métrica "${metrica}" e KPI "${kpi}" (linhas ${lns.join(', ')}). Custo unitário e resultado seguem o KPI (${kpi}); ${metrica.toLowerCase()} aparece como métrica secundária. Objetivo primário da aba: "${flight.objetivoPrimario}".`);
  }
  if (semUtm.length) {
    aviso('V5_SEM_UTM', 'info', `${semUtm.length} linha(s) sem URL de destino com UTM (linhas ${semUtm.join(', ')}) — sem isso não dá para medir connect rate e conversão pós-clique.`);
  }
  // V2 — soma das linhas x total da planilha
  const t = flight.totaisPlanilha;
  if (t && t.investimento !== null && Math.abs(t.investimento - totalInvest) > Math.max(5, itens.length * 2)) {
    aviso('V2_TOTAL', 'atencao', `Soma do Investimento Plataforma das linhas (${(totalInvest / 100).toFixed(2)}) ≠ TOTAL DO PLANO (${(t.investimento / 100).toFixed(2)}).`);
  }
  if (t && t.pctPlano !== null && Math.abs(t.pctPlano - 1) > 0.005) {
    aviso('V2_PCT_TOTAL', 'atencao', `"% do Plano" total da aba fecha em ${(t.pctPlano * 100).toFixed(1)}% (deveria ser 100%).`);
  }
  // V3 — resumo por plataforma x linhas
  const somaPorPlat = {};
  for (const i of itens) somaPorPlat[normalizar(i.plataforma)] = (somaPorPlat[normalizar(i.plataforma)] || 0) + i.investimento;
  for (const [plat, valor] of Object.entries(flight.resumoPlanilha || {})) {
    const soma = somaPorPlat[plat] || 0;
    if (valor !== null && Math.abs(valor - soma) > 100) {
      aviso('V3_RESUMO_PLATAFORMA', 'atencao', `"Resumo por plataforma" mostra ${(valor / 100).toFixed(2)} em ${plat}, mas as linhas somam ${(soma / 100).toFixed(2)}. O monitor usa as linhas.`);
    }
  }
  // V8 — custo unitário fora da curva (mesmo KPI e produto)
  const grupos = {};
  for (const i of itens) if (i.custoUnitPlan) (grupos[`${i.produto}|${i.kpi}`] ||= []).push(i);
  for (const lista of Object.values(grupos)) {
    if (lista.length < 3) continue;
    const ord = lista.map((i) => i.custoUnitPlan).sort((a, b) => a - b);
    const mediana = ord[Math.floor(ord.length / 2)];
    for (const i of lista) {
      if (i.custoUnitPlan > mediana * 2 || i.custoUnitPlan < mediana * 0.5) {
        aviso('V8_CUSTO_FORA_DA_CURVA', 'atencao', `Linha ${i.linhaPlanilha} (${i.produto} ${i.praca}): custo unitário planejado ${(i.custoUnitPlan / 100).toFixed(2)} contra mediana ${(mediana / 100).toFixed(2)} nas linhas parecidas. Confirmar se é intencional.`, { linhaId: i.id, linhaPlanilha: i.linhaPlanilha });
      }
    }
  }
}

/**
 * Lê o plano inteiro.
 * @param {{nome:string, linhas:any[][]}[]} abas
 * @param {{arquivo?:string, importadoEm?:string}} meta
 */
export function lerPlano(abas, meta = {}) {
  const avisos = [];
  const flights = [];
  const linhas = [];
  for (const aba of abas) {
    const res = lerAba(aba, avisos);
    if (!res) continue;
    flights.push(res.flight);
    linhas.push(...res.itens);
  }
  const cliente = flights.find((f) => f.cliente)?.cliente || 'Cliente sem nome';
  const veiculo = flights.find((f) => f.veiculo)?.veiculo || '';

  // V6 — mesma turma em linhas sobrepostas de flights diferentes
  const porTurma = {};
  for (const l of linhas) for (const c of l.codigosTurma) (porTurma[`${l.produto}|${c}|${l.praca}`] ||= []).push(l);
  for (const [chave, lista] of Object.entries(porTurma)) {
    for (let a = 0; a < lista.length; a++) for (let b = a + 1; b < lista.length; b++) {
      const x = lista[a], y = lista[b];
      if (x.flightId !== y.flightId && x.inicio <= y.fim && y.inicio <= x.fim) {
        avisos.push({
          codigo: 'V6_SOBREPOSICAO', severidade: 'info', aba: `${x.aba} × ${y.aba}`,
          mensagem: `Turma ${chave.split('|')[1]} (${chave.split('|')[2]}) tem verba em flights sobrepostos: ${x.inicio}→${x.fim} e ${y.inicio}→${y.fim}. Nos dias comuns, o gasto é rateado pela diária planejada de cada linha.`,
        });
      }
    }
  }
  // V9 — parâmetros diferentes entre abas
  const assinatura = (f) => JSON.stringify([f.params.divisorBrutoVeiculo, f.params.comissao, f.params.descontoPlataforma]);
  if (new Set(flights.map(assinatura)).size > 1) {
    avisos.push({ codigo: 'V9_PARAMETROS', severidade: 'atencao', aba: '—', mensagem: 'Parâmetros da cascata (98% / 20% / 12,15%) diferem entre abas do mesmo plano.' });
  }

  const versao = (String(meta.arquivo || '').match(/REV\s*\d+/i) || [''])[0].toUpperCase().replace(/\s/g, '');
  return {
    id: slug(`${cliente}-${meta.arquivo || 'plano'}`),
    cliente,
    clienteId: slug(cliente),
    veiculo,
    arquivo: meta.arquivo || '',
    versao,
    importadoEm: meta.importadoEm || new Date().toISOString(),
    flights,
    linhas,
    avisos,
  };
}

/** Diferença entre duas versões do plano (para confirmar uma REV nova antes de trocar). */
export function diffPlanos(antigo, novo) {
  const chave = (l) => `${l.aba}|${l.produto}|${normalizar(l.codigoRaw)}|${l.praca}`;
  const mapa = (p) => new Map(p.linhas.map((l) => [chave(l), l]));
  const a = mapa(antigo), b = mapa(novo);
  const novas = [], removidas = [], alteradas = [];
  for (const [k, l] of b) {
    if (!a.has(k)) { novas.push(l); continue; }
    const o = a.get(k);
    const campos = ['investimento', 'inicio', 'fim', 'kpi', 'custoUnitPlan', 'resultadosPlan']
      .filter((c) => o[c] !== l[c])
      .map((c) => ({ campo: c, de: o[c], para: l[c] }));
    if (campos.length) alteradas.push({ linha: l, campos });
  }
  for (const [k, l] of a) if (!b.has(k)) removidas.push(l);
  return { novas, removidas, alteradas };
}

export { addDias };

/** Rótulo curto de uma linha: "EMPRETEC · RECIFE · EV-84162 · OUTUBRO". */
export function rotuloLinha(l) {
  const cod = l.codigosTurma.length ? l.codigosTurma.join('+') : l.codigoRaw || 'sem código';
  return `${l.produto} · ${l.praca} · ${cod} · ${rotuloFlight(l.aba)}`;
}
/** "PERFORMANCE_OUTUBRO_Acrescimo" → "OUTUBRO Acrescimo". */
export function rotuloFlight(aba) {
  return String(aba || '').replace(/^PERFORMANCE[_\s-]*/i, '').replace(/_/g, ' ').trim() || aba;
}
/** Rótulo sem o flight: "EMPRETEC RECIFE EV-84162". */
export function rotuloCurto(l) {
  const cod = l.codigosTurma.length ? l.codigosTurma.join('+') : l.codigoRaw || '';
  return `${l.produto} ${l.praca} ${cod}`.trim();
}
