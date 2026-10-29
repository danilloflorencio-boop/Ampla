// Cenários da página de teste do painel (teste-painel.html). Dados 100% fictícios.
// Cada linha de cada conta simula um caso: no ritmo, acima, abaixo, verba esgotada, conjunto
// parado, orçamento total, tipo de orçamento não informado, fora da margem mas longe do fim,
// dado desatualizado, conta sem analista, linha agendada e encerrada.
// "tudo-certo" é a mesma carteira com tudo no ritmo: o chat fica em silêncio.
// Determinístico: mesmo cenário → mesmos números (o teste tests/cenarios.test.js confere).

import { addDias, diasInclusivos } from '../core/format.js';

export const REF_TESTE = '2026-10-20';

const P = (nome, email, lider = null, lideranca = false) => ({ nome, email: `${email}@exemplo.com`, lider: lider && `${lider}@exemplo.com`, lideranca });
export const EQUIPE_TESTE = {
  pessoas: [
    P('Helena Prado', 'helena.prado', null, true),
    P('Igor Matos', 'igor.matos', null, true),
    P('Bruna Lima', 'bruna.lima', 'helena.prado'),
    P('Caio Rocha', 'caio.rocha', 'helena.prado'),
    P('Elisa Ramos', 'elisa.ramos', 'helena.prado'),
    P('Duda Nunes', 'duda.nunes', 'igor.matos'),
    P('Fábio Couto', 'fabio.couto', 'igor.matos'),
    P('Gabi Torres', 'gabi.torres', 'igor.matos'),
  ],
};
const A = (nome) => `${nome}@exemplo.com`;

// Linha: investimento em reais; início e fim relativos à data de referência (dias);
// fator = gasto real ÷ planejado; orc = tipo de orçamento do conjunto na plataforma;
// parado = dias finais sem gasto; ateDado = último dia com dado (relativo), se o dado parou.
// espera = o que o painel deve mostrar (aviso no chat e ação), conferido no teste.
const L = (produto, praca, inv, ini, fim, fator, extra = {}) => ({ produto, praca, inv, ini, fim, fator, orc: 'diario', ...extra });

const CARTEIRA = [
  { cliente: 'Rede Farma Sol', analista: 'bruna.lima', contas: {
    'META ADS': [
      L('INSTITUCIONAL', 'NORDESTE', 180000, -16, 6, 1.32, { simula: 'Acima do ritmo a 7 dias do fim', espera: { aviso: true, acao: 'diario' } }),
      L('OFERTAS', 'RECIFE', 95000, -24, 6, 1.0, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
    'GOOGLE ADS': [
      L('SEARCH MARCA', 'NORDESTE', 120000, -15, 15, 1.01, { simula: 'No ritmo, longe do fim', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Construtora Horizonte', analista: 'caio.rocha', contas: {
    'META ADS': [
      L('LANÇAMENTO TORRE SUL', 'FORTALEZA', 420000, -26, 4, 0.62, { simula: 'Muito abaixo a 5 dias do fim', espera: { aviso: true, acao: 'diario' } }),
    ],
    'GOOGLE ADS': [
      L('PMAX LEADS', 'FORTALEZA', 260000, -26, 4, 0.94, { simula: 'Dentro da margem (−6%)', espera: { aviso: false } }),
    ],
    'TIKTOK ADS': [
      L('ALCANCE', 'FORTALEZA', 80000, -10, 20, 1.45, { simula: 'Muito acima, mas a 21 dias do fim: oscilação natural', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Banco Aurora', analista: 'elisa.ramos', contas: {
    'META ADS': [
      L('CARTÃO', 'BRASIL', 900000, -20, 9, 1.18, { orc: 'vitalicio', simula: 'Acima com orçamento total (vitalício)', espera: { aviso: true, acao: 'total' } }),
    ],
    'GOOGLE ADS': [
      L('CONTA DIGITAL', 'BRASIL', 650000, -20, 10, 0.97, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
    'LINKEDIN ADS': [
      L('INVESTIMENTOS', 'BRASIL', 150000, -20, 9, 0.86, { orc: null, simula: 'Abaixo, sem tipo de orçamento no realizado', espera: { aviso: true, acao: 'indefinido' } }),
    ],
  } },
  { cliente: 'Universidade Atlântico', analista: 'duda.nunes', contas: {
    'META ADS': [
      L('VESTIBULAR', 'SALVADOR', 310000, -20, 6, 1.25, { simula: 'Verba esgota antes do fim', espera: { aviso: true, acao: 'diario' } }),
      L('PÓS-GRADUAÇÃO', 'SALVADOR', 140000, -28, 2, 1.17, { simula: 'Verba já consumida', espera: { aviso: true, acao: 'esgotada' } }),
    ],
    'GOOGLE ADS': [
      L('VESTIBULAR', 'SALVADOR', 220000, -27, 2, 1.05, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Moda Vento', analista: 'fabio.couto', contas: {
    'META ADS': [
      L('COLEÇÃO VERÃO', 'SÃO PAULO', 240000, -22, 8, 0.71, { parado: 8, simula: 'Conjunto parado há 8 dias', espera: { aviso: true, acao: 'parado' } }),
    ],
    'PINTEREST ADS': [
      L('INSPIRAÇÃO', 'SÃO PAULO', 60000, -22, 8, 1.02, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Supermercados Ponte', analista: 'gabi.torres', contas: {
    'META ADS': [
      L('ENCARTE SEMANAL', 'NATAL', 130000, -18, 12, 1.4, { ateDado: -5, simula: 'Dado desatualizado (carga parou há 5 dias)', espera: { aviso: false, desatualizado: true } }),
    ],
    'GOOGLE ADS': [
      L('SHOPPING', 'NATAL', 90000, -18, 12, 1.4, { ateDado: -5, simula: 'Dado desatualizado', espera: { aviso: false, desatualizado: true } }),
    ],
  } },
  { cliente: 'Auto Center Rota', analista: null, contas: {
    'GOOGLE ADS': [
      L('REVISÃO', 'JOÃO PESSOA', 70000, -25, 5, 0.78, { simula: 'Abaixo a 6 dias do fim, mas o cliente não tem analista', espera: { aviso: true, acao: 'diario', semResponsavel: true } }),
    ],
  } },
  { cliente: 'Clínica Vida Plena', analista: 'bruna.lima', contas: {
    'META ADS': [
      L('CHECK-UP', 'RECIFE', 110000, 5, 34, 1.0, { simula: 'Agendada (começa em 5 dias)', espera: { aviso: false, agendada: true } }),
    ],
  } },
  { cliente: 'Imobiliária Porto Alto', analista: 'caio.rocha', contas: {
    'META ADS': [
      L('ALUGUEL', 'MACEIÓ', 85000, -40, -11, 1.12, { simula: 'Encerrada há 11 dias', espera: { aviso: false, encerrada: true } }),
    ],
    'GOOGLE ADS': [
      L('VENDA', 'MACEIÓ', 160000, -12, 18, 1.03, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Cooperativa Agro Sertão', analista: 'elisa.ramos', contas: {
    'META ADS': [
      L('FEIRA AGRO', 'PETROLINA', 200000, -21, 9, 1.08, { simula: 'Acima, mas dentro da margem (+8%)', espera: { aviso: false } }),
      L('ASSOCIADOS', 'PETROLINA', 75000, -21, 9, 0.84, { simula: 'Abaixo a 10 dias do fim (último dia da janela)', espera: { aviso: true, acao: 'diario' } }),
    ],
  } },
  { cliente: 'Editora Página', analista: 'duda.nunes', contas: {
    'GOOGLE ADS': [
      L('LANÇAMENTOS', 'BRASIL', 55000, -19, 11, 0.8, { simula: 'Abaixo a 12 dias do fim: ainda fora da janela', espera: { aviso: false } }),
    ],
    'META ADS': [
      L('CLUBE DO LIVRO', 'BRASIL', 45000, -19, 11, 0.99, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
  } },
  { cliente: 'Turismo Mar Azul', analista: 'gabi.torres', contas: {
    'META ADS': [
      L('PACOTES VERÃO', 'NORDESTE', 380000, -23, 7, 1.27, { simula: 'Muito acima a 8 dias do fim', espera: { aviso: true, acao: 'diario' } }),
    ],
    'GOOGLE ADS': [
      L('PACOTES VERÃO', 'NORDESTE', 290000, -23, 7, 0.88, { orc: 'vitalicio', simula: 'Abaixo com orçamento total', espera: { aviso: true, acao: 'total' } }),
    ],
    'TIKTOK ADS': [
      L('DESTINOS', 'NORDESTE', 95000, -23, 7, 1.0, { simula: 'No ritmo', espera: { aviso: false } }),
    ],
  } },
];

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "tudo-certo": a mesma carteira com cada linha no ritmo, dado em dia e analista definido. */
function noRitmo(c) {
  return {
    ...c,
    analista: c.analista ?? 'fabio.couto',
    contas: Object.fromEntries(Object.entries(c.contas).map(([plat, linhas]) => [plat, linhas.map((l) => ({
      ...l, fator: 1, parado: 0, ateDado: null, simula: l.espera.agendada ? l.simula : l.espera.encerrada ? 'Encerrada no ritmo' : 'No ritmo',
      espera: { aviso: false, agendada: l.espera.agendada, encerrada: l.espera.encerrada },
    }))])),
  };
}

// ruído diário de ±5% com média zero em cada par de dias: o índice fica no fator escolhido
const ruido = (i) => 1 + (i % 2 ? -0.05 : 0.05);

function montarCliente(c, ref) {
  const clienteId = slug(c.cliente);
  const flightId = `${clienteId}:OUTUBRO`;
  const linhas = [];
  const realizado = [];
  const vinculos = {};
  const roteiro = [];
  let n = 0;
  for (const [plataforma, specs] of Object.entries(c.contas)) {
    const contaId = `act_${clienteId}_${slug(plataforma)}`;
    for (const s of specs) {
      n++;
      const inicio = addDias(ref, s.ini), fim = addDias(ref, s.fim);
      const dias = diasInclusivos(inicio, fim);
      const investimento = s.inv * 100;
      const diariaPlan = Math.round(investimento / dias);
      const id = `${flightId}:L${n}`;
      linhas.push({
        id, flightId, aba: 'PERFORMANCE_OUTUBRO', linhaPlanilha: 10 + n, plataforma, produto: s.produto, praca: s.praca,
        codigoRaw: '', codigosTurma: [], tipoCodigo: 'sem', etapa: '', objetivo: '', formato: '', segmentacao: '', destino: '',
        dataTurmaTexto: '', dataTurmaInicio: null, dataTurmaFim: null, inicio, fim, dias, metrica: '', kpi: 'CPM',
        custoUnitPlan: null, resultadosPlan: 0, investimento, diariaPlan, observacoes: '',
      });
      const conjuntoId = `adset_${clienteId}_${n}`;
      const campanhaId = `cmp_${clienteId}_${n}`;
      const r0 = { plataforma, contaId, contaNome: `${c.cliente} · ${plataforma.replace(' ADS', '')}`, campanhaId, campanhaNome: `${slug(c.cliente).toUpperCase()}_${s.produto}`, conjuntoId, conjuntoNome: `${s.praca}_${s.produto}` };
      vinculos[`${plataforma}|${contaId}|${campanhaId}|${conjuntoId}`] = { linhas: [id], origem: 'manual' };
      const ultimo = s.ateDado === null || s.ateDado === undefined ? ref : addDias(ref, s.ateDado);
      let i = 0;
      for (let d = inicio; d <= fim && d <= ultimo; d = addDias(d, 1), i++) {
        const parado = s.parado && d > addDias(ref, -1 - s.parado);
        let gasto = parado ? 0 : Math.round(diariaPlan * s.fator * ruido(i));
        if (d === ref) gasto = Math.round(gasto * 0.35); // dia corrente parcial
        realizado.push({
          ...r0, data: d, moeda: 'BRL', gasto, impressoes: null, alcance: null, cliques: null, cliquesLink: null, leads: null,
          conversoes: null, engajamentos: null, visualizacoes: null,
          orcamentoDiario: s.orc === 'vitalicio' ? null : Math.round(diariaPlan * s.fator), tipoOrcamento: s.orc, statusEntrega: 'ACTIVE',
          dataExtracao: `${ultimo}T06:00:00-03:00`,
        });
      }
      roteiro.push({ clienteId, cliente: c.cliente, plataforma, linhaId: id, produto: s.produto, praca: s.praca, investimento, fator: s.fator, simula: s.simula, espera: s.espera });
    }
  }
  const plano = {
    id: `${clienteId}-teste`, cliente: c.cliente, clienteId, veiculo: 'Teste', arquivo: `${c.cliente} · teste.xlsx`, versao: 'TESTE',
    importadoEm: `${ref}T08:00:00.000Z`,
    flights: [{ id: flightId, aba: 'PERFORMANCE_OUTUBRO', cliente: c.cliente, inicio: linhas.map((l) => l.inicio).sort()[0], fim: linhas.map((l) => l.fim).sort().at(-1), linhaIds: linhas.map((l) => l.id), investimento: linhas.reduce((t, l) => t + l.investimento, 0), meta: 0, params: {}, avisos: [] }],
    linhas, avisos: [],
  };
  const ws = {
    clienteId, cliente: c.cliente, analista: c.analista ? A(c.analista) : null, planos: [plano], planoAtivo: plano.id,
    realizado, vinculos, decisoes: {}, justificativas: {}, notas: [], config: {}, historico: [],
  };
  return { ws, roteiro };
}

/**
 * @param {'problemas'|'tudo-certo'} nome
 * @returns {{ ref, workspaces, equipe, roteiro }}
 */
export function montarCenario(nome = 'problemas', ref = REF_TESTE) {
  const carteira = nome === 'tudo-certo' ? CARTEIRA.map(noRitmo) : CARTEIRA;
  const partes = carteira.map((c) => montarCliente(c, ref));
  return { ref, workspaces: partes.map((p) => p.ws), equipe: structuredClone(EQUIPE_TESTE), roteiro: partes.flatMap((p) => p.roteiro) };
}

/** Ação que o aviso recomenda para a linha (mesma escolha de textoLinha em avisos.js). */
export const acaoDoAviso = (m) => (m.ajuste.tipo === 'esgotada' ? 'esgotada' : m.ajuste.tipo === 'total' ? 'total' : m.media === 0 ? 'parado' : m.ajuste.tipo);

/**
 * Confere cada caso do roteiro contra o painel e os avisos calculados.
 * @returns {{ ...roteiro, conta, obtido: { fora, acao, desatualizado, situacao, semResponsavel, emMensagem }, ok }[]}
 */
export function conferirRoteiro(roteiro, painel, avisos) {
  return roteiro.map((r) => {
    const conta = painel.contas.find((x) => x.id === `${r.clienteId}|${r.plataforma}`);
    const m = conta.fora.find((x) => x.linhaId === r.linhaId);
    const obtido = {
      fora: !!m, acao: m ? acaoDoAviso(m) : null, desatualizado: conta.desatualizado, situacao: conta.situacao,
      ativa: conta.metricas.some((x) => x.linhaId === r.linhaId),
      semResponsavel: avisos.semResponsavel.some((x) => x.id === conta.id),
      emMensagem: avisos.avisos.some((a) => a.contas.includes(conta.id) && m),
    };
    const e = r.espera;
    const ok = obtido.fora === !!e.aviso
      && (!e.aviso || obtido.acao === e.acao)
      && (!e.desatualizado || obtido.desatualizado)
      && (!e.agendada || obtido.situacao === 'agendada')
      && (!e.encerrada || !obtido.ativa)
      && (!e.semResponsavel || (obtido.semResponsavel && !obtido.emMensagem));
    return { ...r, conta, obtido, ok };
  });
}
