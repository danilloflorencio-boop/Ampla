// Tudo o que as telas de um cliente usam, calculado de uma vez: métricas por linha (com filtro),
// alertas só de pacing, sugestões de vínculo e opções de filtro. Sem DOM: serve ao monitor
// (src/ui/app.js) e à página de teste (src/ui/teste.js).
import { entidadesDoRealizado, ultimaExtracao } from './realizado.js';
import { sugerirVinculos, alocarRealizado } from './vinculo.js';
import { calcularTudo, agregar, indexarAlocacoes } from './pacing.js';
import { avaliarRegras, aplicarDecisoes } from './regras.js';
import { planoAtivo, soPacing } from './painel.js';
import { configDoCliente } from '../config/config.js';

/**
 * @param {object} w      workspace do cliente
 * @param {string} ref    data de referência
 * @param {{ plataforma?, flight?, produto?, praca?, situacao? }} f  filtros
 */
export function contextoCliente(w, ref, f = {}) {
  const plano = planoAtivo(w);
  if (!w || !plano) return null;
  const cfg = configDoCliente(w.config);
  const registros = w.realizado;
  const entidades = entidadesDoRealizado(registros);
  const nomes = new Map(entidades.map((e) => [e.chave, e]));
  const sugestoes = sugerirVinculos(entidades, plano.linhas, w.vinculos);
  const alloc = alocarRealizado(registros, plano.linhas, w.vinculos, ref);
  const { metricas: metricasTodas } = calcularTudo(plano.linhas, alloc.alocacoes, ref, cfg);
  const metricas = metricasTodas.filter((m) => (!f.plataforma || m.linha.plataforma === f.plataforma) && (!f.flight || m.linha.flightId === f.flight)
    && (!f.produto || m.linha.produto === f.produto) && (!f.praca || m.linha.praca === f.praca) && (!f.situacao || m.situacao === f.situacao));
  const total = agregar(metricas, cfg);
  const ext = ultimaExtracao(registros);
  const brutos = avaliarRegras({
    metricas: metricasTodas, flights: plano.flights, registros, orfaos: alloc.orfaos, foraDoPeriodo: alloc.foraDoPeriodo,
    vinculos: w.vinculos, sugestoes, nomes, justificativas: w.justificativas, ref, ultimaExtracao: ext, cfg,
    alocacoesPorLinha: indexarAlocacoes(alloc.alocacoes),
  });
  const alertas = aplicarDecisoes(soPacing(brutos, cfg), w.decisoes, ref);
  const ids = new Set(metricas.map((m) => m.linhaId));
  const filtrando = Object.values(f).some(Boolean);
  const alertasFiltrados = !filtrando ? alertas : alertas.filter((a) => {
    const e = a.entidade;
    if (e.tipo === 'linha') return ids.has(e.id);
    if (e.tipo === 'par') return e.id.split('>').some((x) => ids.has(x));
    if (e.tipo === 'conjunto') { const v = w.vinculos[e.id]; return !v || v.linhas.some((x) => ids.has(x)); }
    if (e.tipo === 'flight') return !f.flight || f.flight === e.id;
    return true;
  });
  const uniq = (arr) => [...new Set(arr)].sort();
  const opcoes = {
    plataformas: uniq(plano.linhas.map((l) => l.plataforma)).map((v) => ({ v, r: v })),
    flights: plano.flights.map((fl) => ({ v: fl.id, r: fl.aba })),
    produtos: uniq(plano.linhas.map((l) => l.produto)).map((v) => ({ v, r: v })),
    pracas: uniq(plano.linhas.map((l) => l.praca)).map((v) => ({ v, r: v })),
  };
  const pendenciasVinculo = entidades.filter((e) => !w.vinculos[e.chave]).length;
  return {
    ws: w, plano, cfg, ref, filtros: f, opcoes, entidades, nomes, sugestoes, alloc,
    metricasTodas, metricas, total, alertas, alertasFiltrados, ultimaExtracao: ext, pendenciasVinculo,
  };
}
