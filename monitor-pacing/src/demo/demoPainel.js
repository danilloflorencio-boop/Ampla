// Demonstração do painel: o plano SEBRAE PE real (REV3) e três clientes fictícios derivados
// dele (datas deslocadas, verba em outra escala, parte das linhas no Google Ads), com uma equipe
// fictícia de analistas e lideranças. Determinístico: mesma data → mesmos números.

import planoDemo from './planoDemo.js';
import { addDias } from '../core/format.js';
import { gerarRealizadoMock } from '../core/mock.js';

export const REF_DEMO = '2026-10-19';

const BRUNA = 'bruna.lima@exemplo.com';
const CAIO = 'caio.rocha@exemplo.com';
const DUDA = 'duda.nunes@exemplo.com';
const HELENA = 'helena.prado@exemplo.com';
const IGOR = 'igor.matos@exemplo.com';

export const EQUIPE_DEMO = {
  pessoas: [
    { nome: 'Helena Prado', email: HELENA, lider: null, lideranca: true },
    { nome: 'Igor Matos', email: IGOR, lider: null, lideranca: true },
    { nome: 'Bruna Lima', email: BRUNA, lider: HELENA },
    { nome: 'Caio Rocha', email: CAIO, lider: HELENA },
    { nome: 'Duda Nunes', email: DUDA, lider: IGOR },
  ],
};

// Fatores de gasto por código de turma (multiplicam a diária planejada a partir de outubro).
const NO_RITMO = { gasto: 1.0, orcamento: 1.0, cpc: 1.0 };
const CLIENTES = [
  { cliente: 'SEBRAE PE', analista: BRUNA },
  {
    cliente: 'Demo Varejo Norte', analista: CAIO, desloca: 2, fator: 2.4, google: 'LIDERE', semente: 7,
    cenarios: { 'EV-99890': { gasto: 1.38, orcamento: 1.2, cpc: 1 }, 'EV-823020': { gasto: 1.22, orcamento: 1.1, cpc: 1 }, 'EV-85474': NO_RITMO, 'EV-84164': NO_RITMO },
  },
  {
    cliente: 'Demo Saúde Vida', analista: DUDA, desloca: -1, fator: 0.6, google: 'EMPRETEC', semente: 11,
    cenarios: { 'EV-85474': { gasto: 0.7, orcamento: 0.8, cpc: 1 }, 'EV-84164': { gasto: 0.96, orcamento: 1, cpc: 1 }, 'EV-99890': NO_RITMO, 'EV-823020': NO_RITMO },
  },
  {
    cliente: 'Demo Edu Mais', analista: DUDA, desloca: 12, fator: 1.3, semente: 23,
    cenarios: { 'EV-99890': { gasto: 0.78, orcamento: 0.8, cpc: 1 }, 'EV-823020': NO_RITMO, 'EV-85474': NO_RITMO, 'EV-84164': NO_RITMO },
  },
];

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Copia o plano com outro cliente, datas deslocadas, verba escalada e um produto movido para o Google Ads. */
export function clonarPlano(base, { cliente, desloca = 0, fator = 1, google = null }) {
  const p = structuredClone(base);
  const d = (iso) => (iso ? addDias(iso, desloca) : iso);
  p.cliente = cliente;
  p.clienteId = slug(cliente);
  p.id = slug(`${cliente}-${base.arquivo || 'plano'}`);
  for (const l of p.linhas) {
    l.inicio = d(l.inicio); l.fim = d(l.fim);
    l.dataTurmaInicio = d(l.dataTurmaInicio); l.dataTurmaFim = d(l.dataTurmaFim);
    l.investimento = Math.round(l.investimento * fator);
    l.diariaPlan = Math.round(l.investimento / (l.dias || 1));
    if (google && l.produto === google) l.plataforma = 'GOOGLE ADS';
  }
  for (const f of p.flights) {
    f.cliente = cliente;
    f.inicio = d(f.inicio); f.fim = d(f.fim); f.inicioEfetivo = d(f.inicioEfetivo); f.fimEfetivo = d(f.fimEfetivo);
    f.investimento = p.linhas.filter((l) => l.flightId === f.id).reduce((s, l) => s + l.investimento, 0);
  }
  return p;
}

/** Planos, realizado e analista responsável de cada cliente da demonstração. */
export function montarDemo(ref = REF_DEMO) {
  return CLIENTES.map((c) => {
    const plano = c.desloca === undefined ? structuredClone(planoDemo) : clonarPlano(planoDemo, c);
    const realizado = gerarRealizadoMock(plano, ref, c.semente ? { semente: c.semente, cenarios: c.cenarios, contaId: `act_${c.semente}0042` } : {});
    return { plano, realizado, analista: c.analista };
  });
}
