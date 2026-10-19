// Ingestão do REALIZADO (gasto e resultados das plataformas).
// Desacoplado da origem: qualquer fonte (CSV manual, conector do BI, API) deve entregar
// linhas no CONTRATO CANÔNICO abaixo — uma linha por dia × conta × campanha × conjunto.
// Documentação para o time de BI: docs/CONTRATO_DADOS.md

import { parseNumero, paraCentavos, parseData, normalizar } from './format.js';

export const CAMPOS_CANONICOS = [
  'data', 'plataforma', 'conta_id', 'conta_nome', 'campanha_id', 'campanha_nome',
  'conjunto_id', 'conjunto_nome', 'moeda', 'gasto', 'impressoes', 'alcance', 'cliques',
  'cliques_link', 'leads', 'conversoes', 'engajamentos', 'visualizacoes_video',
  'orcamento_diario_config', 'tipo_orcamento', 'status_entrega', 'data_extracao',
];

// Nomes alternativos aceitos (exports de Meta, Google, Windsor.ai, Supermetrics etc.).
const ALIASES = {
  data: ['data', 'date', 'day', 'dia', 'reporting starts', 'data_inicio_relatorio'],
  plataforma: ['plataforma', 'platform', 'source', 'datasource', 'fonte', 'canal'],
  conta_id: ['conta_id', 'account_id', 'customer_id', 'advertiser_id', 'id da conta'],
  conta_nome: ['conta_nome', 'account_name', 'account', 'nome da conta', 'conta'],
  campanha_id: ['campanha_id', 'campaign_id', 'id da campanha'],
  campanha_nome: ['campanha_nome', 'campaign_name', 'campaign', 'nome da campanha', 'campanha'],
  conjunto_id: ['conjunto_id', 'adset_id', 'ad_set_id', 'ad_group_id', 'adgroup_id', 'id do conjunto de anuncios'],
  conjunto_nome: ['conjunto_nome', 'adset_name', 'ad_set_name', 'ad_group_name', 'adgroup_name', 'adset', 'ad group', 'nome do conjunto de anuncios', 'conjunto'],
  moeda: ['moeda', 'currency'],
  gasto: ['gasto', 'spend', 'cost', 'amount_spent', 'valor usado', 'valor usado (brl)', 'custo', 'investimento'],
  impressoes: ['impressoes', 'impressions'],
  alcance: ['alcance', 'reach'],
  cliques: ['cliques', 'clicks', 'cliques (todos)', 'clicks_all'],
  cliques_link: ['cliques_link', 'link_clicks', 'inline_link_clicks', 'cliques no link'],
  leads: ['leads', 'lead', 'results_leads', 'cadastros'],
  conversoes: ['conversoes', 'conversions', 'resultados', 'results'],
  engajamentos: ['engajamentos', 'engagements', 'post_engagement', 'engajamento com a publicacao'],
  visualizacoes_video: ['visualizacoes_video', 'video_views', 'views', 'thruplays', 'video_thruplay'],
  orcamento_diario_config: ['orcamento_diario_config', 'daily_budget', 'adset_daily_budget', 'budget_amount', 'orcamento diario'],
  tipo_orcamento: ['tipo_orcamento', 'budget_type'],
  status_entrega: ['status_entrega', 'delivery_status', 'effective_status', 'status'],
  data_extracao: ['data_extracao', 'extracted_at', 'extraction_date', 'updated_at', 'data de extracao'],
};

const MAPA_ALIAS = (() => {
  const m = new Map();
  for (const [canon, lista] of Object.entries(ALIASES)) for (const a of lista) m.set(normalizar(a).replace(/[_\s]+/g, ' '), canon);
  return m;
})();
const canonDoCabecalho = (h) => MAPA_ALIAS.get(normalizar(h).replace(/[_\s]+/g, ' ')) || null;

/** CSV → matriz. Detecta ; ou , ou tab; aceita aspas e quebras de linha em campos. */
export function lerCSV(texto) {
  const t = String(texto).replace(/^\uFEFF/, '');
  const primeira = t.split(/\r?\n/, 1)[0] || '';
  const conta = (ch) => primeira.split(ch).length;
  const sep = [';', '\t', ','].sort((a, b) => conta(b) - conta(a))[0];
  const linhas = [];
  let row = [], cel = '', aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { cel += '"'; i++; }
      else if (c === '"') aspas = false;
      else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { row.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cel); linhas.push(row); row = []; cel = '';
    } else cel += c;
  }
  if (cel !== '' || row.length) { row.push(cel); linhas.push(row); }
  return linhas.filter((r) => r.some((x) => String(x).trim() !== ''));
}

const inteiroOuNull = (v) => {
  const n = parseNumero(v);
  return n === null ? null : Math.round(n);
};

/**
 * Converte uma matriz (cabeçalho + linhas) no contrato canônico.
 * @returns {{ registros: object[], avisos: string[], colunasNaoReconhecidas: string[] }}
 */
export function normalizarRealizado(matriz, { plataformaPadrao = null, dataExtracaoPadrao = null } = {}) {
  const avisos = [];
  if (!matriz.length) return { registros: [], avisos: ['Arquivo vazio.'], colunasNaoReconhecidas: [] };
  const cab = matriz[0].map((h) => String(h ?? ''));
  const idx = {};
  const naoReconhecidas = [];
  cab.forEach((h, i) => {
    const c = canonDoCabecalho(h);
    if (c && idx[c] === undefined) idx[c] = i;
    else if (!c && h.trim()) naoReconhecidas.push(h);
  });
  for (const obrig of ['data', 'gasto']) if (idx[obrig] === undefined) avisos.push(`Coluna obrigatória ausente: ${obrig}.`);
  if (idx.conjunto_id === undefined && idx.conjunto_nome === undefined && idx.campanha_nome === undefined) {
    avisos.push('Sem conjunto nem campanha: impossível vincular o gasto ao plano.');
  }
  if (avisos.length) return { registros: [], avisos, colunasNaoReconhecidas: naoReconhecidas };

  const g = (row, c) => (idx[c] === undefined ? null : row[idx[c]]);
  const registros = [];
  let descartadas = 0;
  for (const row of matriz.slice(1)) {
    const data = parseData(g(row, 'data'));
    const gasto = paraCentavos(g(row, 'gasto'));
    if (!data || gasto === null) { descartadas++; continue; }
    const plataforma = normalizarPlataforma(g(row, 'plataforma') || plataformaPadrao || '');
    const campanhaNome = String(g(row, 'campanha_nome') ?? '').trim();
    const conjuntoNome = String(g(row, 'conjunto_nome') ?? '').trim();
    registros.push({
      data,
      plataforma,
      contaId: String(g(row, 'conta_id') ?? '').trim(),
      contaNome: String(g(row, 'conta_nome') ?? '').trim(),
      campanhaId: String(g(row, 'campanha_id') ?? '').trim() || campanhaNome,
      campanhaNome,
      conjuntoId: String(g(row, 'conjunto_id') ?? '').trim() || conjuntoNome,
      conjuntoNome,
      moeda: String(g(row, 'moeda') ?? 'BRL').trim() || 'BRL',
      gasto,
      impressoes: inteiroOuNull(g(row, 'impressoes')),
      alcance: inteiroOuNull(g(row, 'alcance')),
      cliques: inteiroOuNull(g(row, 'cliques')),
      cliquesLink: inteiroOuNull(g(row, 'cliques_link')),
      leads: inteiroOuNull(g(row, 'leads')),
      conversoes: inteiroOuNull(g(row, 'conversoes')),
      engajamentos: inteiroOuNull(g(row, 'engajamentos')),
      visualizacoes: inteiroOuNull(g(row, 'visualizacoes_video')),
      orcamentoDiario: paraCentavos(g(row, 'orcamento_diario_config')),
      tipoOrcamento: String(g(row, 'tipo_orcamento') ?? '').trim().toLowerCase() || null,
      statusEntrega: String(g(row, 'status_entrega') ?? '').trim() || null,
      dataExtracao: String(g(row, 'data_extracao') ?? '').trim() || dataExtracaoPadrao,
    });
  }
  if (descartadas) avisos.push(`${descartadas} linha(s) descartada(s) sem data ou gasto válido.`);
  const moedas = new Set(registros.map((r) => r.moeda));
  if (moedas.size > 1 || (moedas.size === 1 && !moedas.has('BRL'))) avisos.push(`Moedas no arquivo: ${[...moedas].join(', ')}. O monitor assume BRL.`);
  return { registros, avisos, colunasNaoReconhecidas: naoReconhecidas };
}

export function normalizarPlataforma(p) {
  const n = normalizar(p);
  if (!n) return '';
  if (n.includes('META') || n.includes('FACEBOOK') || n.includes('INSTAGRAM')) return 'META ADS';
  if (n.includes('GOOGLE') || n.includes('ADWORDS') || n.includes('YOUTUBE')) return 'GOOGLE ADS';
  if (n.includes('TIKTOK')) return 'TIKTOK ADS';
  if (n.includes('PINTEREST')) return 'PINTEREST ADS';
  if (n.includes('LINKEDIN')) return 'LINKEDIN ADS';
  return n;
}

/** Chave da entidade de veiculação (conjunto) — usada no de-para. */
export const chaveEntidade = (r) => `${r.plataforma}|${r.contaId}|${r.campanhaId}|${r.conjuntoId}`;
const chaveRegistro = (r) => `${r.data}|${chaveEntidade(r)}`;

/** Upsert idempotente: recarregar o mesmo dia substitui, não duplica. */
export function mesclarRealizado(existentes, novos) {
  const mapa = new Map(existentes.map((r) => [chaveRegistro(r), r]));
  let inseridos = 0, atualizados = 0;
  for (const r of novos) {
    const k = chaveRegistro(r);
    if (mapa.has(k)) atualizados++; else inseridos++;
    mapa.set(k, r);
  }
  const registros = [...mapa.values()].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return { registros, inseridos, atualizados };
}

/** Lista de entidades (conjuntos) com totais, para a tela de vínculos. */
export function entidadesDoRealizado(registros) {
  const m = new Map();
  for (const r of registros) {
    const k = chaveEntidade(r);
    const e = m.get(k) || {
      chave: k, plataforma: r.plataforma, contaId: r.contaId, contaNome: r.contaNome,
      campanhaId: r.campanhaId, campanhaNome: r.campanhaNome, conjuntoId: r.conjuntoId, conjuntoNome: r.conjuntoNome,
      gasto: 0, primeiroDia: r.data, ultimoDia: r.data, dias: 0,
    };
    e.gasto += r.gasto;
    e.dias++;
    if (r.data < e.primeiroDia) e.primeiroDia = r.data;
    if (r.data > e.ultimoDia) e.ultimoDia = r.data;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.gasto - a.gasto);
}

/** Data de extração mais recente (ISO) — mostrada em todas as telas. */
export function ultimaExtracao(registros) {
  let max = null;
  for (const r of registros) if (r.dataExtracao && (!max || r.dataExtracao > max)) max = r.dataExtracao;
  return max;
}

/** Exporta registros canônicos em CSV (modelo para o BI e para backup). */
export function paraCSV(registros) {
  const cab = CAMPOS_CANONICOS;
  const val = (r, c) => {
    const mapa = {
      data: r.data, plataforma: r.plataforma, conta_id: r.contaId, conta_nome: r.contaNome,
      campanha_id: r.campanhaId, campanha_nome: r.campanhaNome, conjunto_id: r.conjuntoId,
      conjunto_nome: r.conjuntoNome, moeda: r.moeda, gasto: (r.gasto / 100).toFixed(2),
      impressoes: r.impressoes, alcance: r.alcance, cliques: r.cliques, cliques_link: r.cliquesLink,
      leads: r.leads, conversoes: r.conversoes, engajamentos: r.engajamentos,
      visualizacoes_video: r.visualizacoes,
      orcamento_diario_config: r.orcamentoDiario === null ? '' : (r.orcamentoDiario / 100).toFixed(2),
      tipo_orcamento: r.tipoOrcamento, status_entrega: r.statusEntrega, data_extracao: r.dataExtracao,
    };
    const v = mapa[c] ?? '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cab.join(','), ...registros.map((r) => cab.map((c) => val(r, c)).join(','))].join('\n');
}
