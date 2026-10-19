// Gerador de REALIZADO de demonstração, determinístico (mesma semente → mesmos dados).
// Serve para desenvolver a UI e testar regras antes do conector do BI existir.
// Cria um conjunto por código de turma (atravessando os flights, como na operação real),
// seguindo o padrão de nomenclatura proposto em docs/NOMENCLATURA.md.

import { addDias, intervalo, normalizar } from './format.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cenários de demonstração por código/praça. Fatores multiplicam a diária planejada.
const CENARIOS_PADRAO = {
  'EV-84164': { gasto: 1.32, orcamento: 1.0, cpc: 0.95, nota: 'over da plataforma (orçamento = plano, entrega +30%)' },
  'EV-85474': { gasto: 0.42, orcamento: 1.0, cpc: 1.1, nota: 'entrega limitada pela plataforma' },
  'EV-99890': { gasto: 1.0, orcamento: 1.0, cpc: 0.7, nota: 'no ritmo e barato (destino de remanejamento)' },
  'EV-823020': { gasto: 0.72, orcamento: 0.75, cpc: 1.45, nota: 'abaixo do ritmo e caro (orçamento configurado menor que o plano)' },
  'EV-84162': { gasto: 1.0, orcamento: 1.0, cpc: 0.9, estende: 1, nota: 'gastou 1 dia além do fim da linha' },
  'EV-824137': { gasto: 1.0, orcamento: 1.0, cpc: 1.0, comecaEm: '2026-10-01', nota: 'só entrou no ar em outubro (Set/2 sem veiculação)' },
};

/**
 * @param {object} plano  resultado de lerPlano
 * @param {string} ref    data de referência (gera até ref − 1, e um parcial em ref)
 * @param {{ semente?: number, cenarios?: object, contaId?: string, contaNome?: string }} opts
 */
export function gerarRealizadoMock(plano, ref, opts = {}) {
  const rnd = mulberry32(opts.semente ?? 20261019);
  const cenarios = opts.cenarios ?? CENARIOS_PADRAO;
  const contaId = opts.contaId ?? 'act_1029384756';
  const contaNome = opts.contaNome ?? `${plano.cliente} · ${plano.veiculo || 'conta'}`;
  const cliente = normalizar(plano.cliente).replace(/[^A-Z0-9]/g, '');
  const extracao = `${ref}T06:00:00-03:00`;
  const ontem = addDias(ref, -1);

  // 1) conjuntos: um por código (ou por produto+praça quando não há código)
  const conjuntos = new Map();
  for (const l of plano.linhas) {
    const codigos = l.codigosTurma.length ? l.codigosTurma : [null];
    for (const cod of codigos) {
      const praca = normalizar(l.praca).replace(/\s+/g, '-');
      const produtoNome = l.produto.replace('/', '-');
      const chave = `${l.plataforma}|${cod || `${l.produto}|${l.praca}`}`;
      if (!conjuntos.has(chave)) {
        const sufixo = l.tipoCodigo === 'extra' ? 'EXTRA' : '30A-EMPREEND';
        conjuntos.set(chave, {
          plataforma: l.plataforma,
          campanhaNome: `${cliente}_${produtoNome}_LEADS_2026`,
          conjuntoNome: cod ? `${cod}_${praca}_${sufixo}` : `${praca}_${produtoNome}_${sufixo}`,
          codigo: cod,
          linhas: [],
        });
      }
      conjuntos.get(chave).linhas.push({ linha: l, fracao: 1 / codigos.length });
    }
  }

  const registros = [];
  let n = 0;
  for (const c of conjuntos.values()) {
    n++;
    const cen = (c.codigo && cenarios[c.codigo]) || { gasto: 0.97 + rnd() * 0.08, orcamento: 1, cpc: 0.9 + rnd() * 0.2 };
    const campanhaId = `cmp_${c.campanhaNome.length}${String(n).padStart(3, '0')}`;
    const conjuntoId = `adset_${String(100000 + n * 7919)}`;
    const ini = c.linhas.map((x) => x.linha.inicio).sort()[0];
    const fimPlano = c.linhas.map((x) => x.linha.fim).sort().at(-1);
    const fim = addDias(fimPlano, cen.estende || 0);
    for (const d of intervalo(ini, fim)) {
      if (d > ref) break;
      if (cen.comecaEm && d < cen.comecaEm) continue;
      const ativas = c.linhas.filter((x) => x.linha.inicio <= d && d <= x.linha.fim);
      const estendido = !ativas.length && cen.estende && c.linhas.some((x) => d > x.linha.fim && d <= addDias(x.linha.fim, cen.estende));
      if (!ativas.length && !estendido) continue;
      const base = ativas.length
        ? ativas.reduce((s, x) => s + x.linha.diariaPlan * x.fracao, 0)
        : c.linhas.at(-1).linha.diariaPlan * c.linhas.at(-1).fracao; // dia "estendido"
      const cpcPlan = (ativas[0] || c.linhas.at(-1)).linha.custoUnitPlan || 700;
      const ruido = 0.85 + rnd() * 0.3;
      // cenários de ritmo valem para outubro; setembro roda perto do plano
      const fator = d >= '2026-10-01' ? cen.gasto : 0.95 + rnd() * 0.1;
      let gasto = Math.round(base * fator * ruido);
      if (d === ref) gasto = Math.round(gasto * 0.35); // dia corrente parcial
      const orcamentoDiario = Math.round(base * (d >= '2026-10-01' ? cen.orcamento : 1));
      const cpc = cpcPlan * (d >= '2026-10-01' ? cen.cpc : 0.95 + rnd() * 0.1) * (0.9 + rnd() * 0.2);
      const cliquesLink = Math.max(0, Math.round(gasto / cpc));
      const leads = Math.round(cliquesLink * (0.06 + rnd() * 0.05));
      const impressoes = Math.round((gasto / 100 / (16 + rnd() * 6)) * 1000);
      registros.push({
        data: d, plataforma: c.plataforma, contaId, contaNome, campanhaId, campanhaNome: c.campanhaNome,
        conjuntoId, conjuntoNome: c.conjuntoNome, moeda: 'BRL', gasto,
        impressoes, alcance: Math.round(impressoes / (1.6 + rnd() * 0.6)), cliques: Math.round(cliquesLink * 1.7),
        cliquesLink, leads, conversoes: leads, engajamentos: Math.round(cliquesLink * 2.4), visualizacoes: null,
        orcamentoDiario, tipoOrcamento: 'diario', statusEntrega: 'ACTIVE', dataExtracao: extracao,
      });
    }
  }

  // 2) um conjunto órfão (teste A/B que não está no plano)
  const campOrfa = `${cliente}_EMPRETEC_LEADS_TESTE-AB`;
  for (let i = 5; i >= 1; i--) {
    const d = addDias(ontem, -i + 1);
    const gasto = Math.round(4500 + rnd() * 2500);
    const cliquesLink = Math.round(gasto / 640);
    registros.push({
      data: d, plataforma: 'META ADS', contaId, contaNome, campanhaId: 'cmp_teste_ab', campanhaNome: campOrfa,
      conjuntoId: 'adset_teste_ab', conjuntoNome: 'TESTE_CRIATIVO-VIDEO_BROAD', moeda: 'BRL', gasto,
      impressoes: Math.round(gasto * 0.55), alcance: Math.round(gasto * 0.3), cliques: cliquesLink * 2, cliquesLink,
      leads: Math.round(cliquesLink * 0.08), conversoes: Math.round(cliquesLink * 0.08), engajamentos: cliquesLink * 3,
      visualizacoes: null, orcamentoDiario: 6000, tipoOrcamento: 'diario', statusEntrega: 'ACTIVE', dataExtracao: extracao,
    });
  }
  return registros.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export { CENARIOS_PADRAO };
