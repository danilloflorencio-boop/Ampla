// Vinculação PLANO ↔ PLATAFORMA.
// Um conjunto (ad set / ad group) é vinculado a uma ou mais linhas do plano. Como a mesma
// turma costuma ganhar verba em vários flights (Set/1, Set/2, Out…), o gasto é alocado DIA
// A DIA: em cada data, vai para a(s) linha(s) vinculada(s) cujo período contém aquela data.
// Se mais de uma linha estiver ativa no mesmo dia, rateia pelo peso manual ou, sem peso,
// pela diária planejada de cada linha.

import { normalizar, extrairCodigosTurma } from './format.js';
import { chaveEntidade } from './realizado.js';

const METRICAS = ['gasto', 'impressoes', 'cliques', 'cliquesLink', 'leads', 'conversoes', 'engajamentos', 'visualizacoes'];

/** Lê o padrão de nomenclatura proposto (docs/NOMENCLATURA.md). Tolerante a nomes livres. */
export function lerNomenclatura(campanhaNome = '', conjuntoNome = '') {
  const texto = `${campanhaNome} ${conjuntoNome}`;
  const partesCampanha = String(campanhaNome).split('_');
  const partesConjunto = String(conjuntoNome).split('_');
  return {
    codigos: extrairCodigosTurma(texto),
    cliente: partesCampanha.length >= 3 ? partesCampanha[0] : null,
    produto: partesCampanha.length >= 3 ? normalizar(partesCampanha[1]) : null,
    praca: partesConjunto.length >= 2 ? normalizar(partesConjunto[1]).replace(/-/g, ' ') : null,
    textoNormalizado: normalizar(texto).replace(/[_\-|/]+/g, ' '),
  };
}

function pontuar(entidade, linha) {
  if (entidade.plataforma && linha.plataforma && normalizar(entidade.plataforma) !== normalizar(linha.plataforma)) {
    return { score: 0, motivos: ['plataforma diferente'] };
  }
  const nome = lerNomenclatura(entidade.campanhaNome, entidade.conjuntoNome);
  const motivos = [];
  let score = 0;
  const codigoBate = linha.codigosTurma.some((c) => nome.codigos.includes(c));
  let pracaBate = false, produtoBate = false;
  if (codigoBate) { score += 50; motivos.push('código da turma'); }
  else if (nome.codigos.length && linha.codigosTurma.length) { score -= 40; motivos.push('código diferente'); }
  const praca = normalizar(linha.praca);
  if (praca && (nome.praca === praca || nome.textoNormalizado.includes(praca))) { score += 20; motivos.push('praça'); pracaBate = true; }
  const produtos = linha.produto.split('/').map(normalizar).filter(Boolean);
  if (produtos.some((p) => nome.produto === p || nome.textoNormalizado.includes(p))) { score += 15; motivos.push('produto'); produtoBate = true; }
  if (entidade.primeiroDia && linha.inicio) {
    const sobrepoe = entidade.primeiroDia <= linha.fim && linha.inicio <= entidade.ultimoDia;
    if (sobrepoe) { score += 15; motivos.push('datas'); } else { score -= 30; motivos.push('sem sobreposição de datas'); }
  }
  return { score, motivos, codigoBate, pracaBate, produtoBate };
}

/**
 * Sugere, para cada entidade sem vínculo, o conjunto de linhas da mesma turma/praça/produto.
 * @returns {{ chave, linhas: string[], confianca: 'alta'|'media'|'baixa', motivos: string[], score }[]}
 */
export function sugerirVinculos(entidades, linhas, vinculosExistentes = {}) {
  const out = [];
  for (const e of entidades) {
    if (vinculosExistentes[e.chave]) continue;
    const pontuadas = linhas
      .map((l) => ({ l, ...pontuar(e, l) }))
      .filter((x) => x.score >= 35)
      .sort((a, b) => b.score - a.score);
    if (!pontuadas.length) continue;
    const melhor = pontuadas[0].score;
    // mesma turma em flights diferentes: se algum candidato bate o código, só ficam os que batem;
    // sem código, exige praça E produto (evita misturar EMPRETEC e LIDERE na mesma praça)
    const algumCodigo = pontuadas.some((x) => x.codigoBate);
    const escolhidas = pontuadas.filter((x) => (algumCodigo ? x.codigoBate : x.pracaBate && x.produtoBate) && x.score >= melhor - 15);
    if (!escolhidas.length) continue;
    const confianca = melhor >= 85 ? 'alta' : melhor >= 50 ? 'media' : 'baixa';
    out.push({
      chave: e.chave,
      linhas: escolhidas.map((x) => x.l.id),
      confianca,
      score: melhor,
      motivos: pontuadas[0].motivos,
    });
  }
  return out;
}

/**
 * Aloca o realizado às linhas do plano.
 * @param {object[]} registros  realizado canônico
 * @param {object[]} linhas     linhas do plano
 * @param {Record<string,{linhas:string[], pesos?:Record<string,number>}>} vinculos
 * @param {string} ateData      só considera dias < ateData (dias fechados); o dia corrente vai em `parcialHoje`
 */
export function alocarRealizado(registros, linhas, vinculos, ateData) {
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const alocacoes = []; // { linhaId, chave, data, fator, gasto, impressoes, …, orcamentoDiario }
  const orfaos = [];
  const foraDoPeriodo = [];
  const parcialHoje = [];
  for (const r of registros) {
    const chave = chaveEntidade(r);
    if (ateData && r.data >= ateData) { if (r.data === ateData) parcialHoje.push(r); continue; }
    const v = vinculos[chave];
    if (!v || !v.linhas?.length) { orfaos.push(r); continue; }
    const ativas = v.linhas.map((id) => porId.get(id)).filter((l) => l && l.inicio <= r.data && r.data <= l.fim);
    if (!ativas.length) { foraDoPeriodo.push({ ...r, chave, linhasVinculadas: v.linhas }); continue; }
    const pesos = ativas.map((l) => v.pesos?.[l.id] ?? l.diariaPlan ?? 1);
    const soma = pesos.reduce((a, b) => a + b, 0) || 1;
    ativas.forEach((l, i) => {
      const fator = pesos[i] / soma;
      const a = { linhaId: l.id, chave, data: r.data, fator, orcamentoDiario: r.orcamentoDiario, tipoOrcamento: r.tipoOrcamento, plataforma: r.plataforma };
      for (const m of METRICAS) a[m] = r[m] === null || r[m] === undefined ? null : m === 'gasto' ? Math.round(r[m] * fator) : r[m] * fator;
      alocacoes.push(a);
    });
  }
  return { alocacoes, orfaos, foraDoPeriodo, parcialHoje };
}

/** Aplica sugestões de uma confiança mínima (ex.: botão "aceitar todas as de alta confiança"). */
export function aplicarSugestoes(vinculos, sugestoes, confiancaMinima = 'alta') {
  const ordem = { baixa: 0, media: 1, alta: 2 };
  const novo = { ...vinculos };
  let aplicadas = 0;
  for (const s of sugestoes) {
    if (ordem[s.confianca] < ordem[confiancaMinima]) continue;
    novo[s.chave] = { linhas: s.linhas, origem: 'sugestao', confianca: s.confianca, confirmadoEm: new Date().toISOString() };
    aplicadas++;
  }
  return { vinculos: novo, aplicadas };
}

export { METRICAS };
