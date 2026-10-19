import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerXlsx } from './_ler_xlsx.js';
import { lerPlano } from '../src/core/plano.js';
import { gerarRealizadoMock } from '../src/core/mock.js';
import { entidadesDoRealizado, ultimaExtracao } from '../src/core/realizado.js';
import { sugerirVinculos, aplicarSugestoes, alocarRealizado } from '../src/core/vinculo.js';
import { calcularTudo, indexarAlocacoes } from '../src/core/pacing.js';
import { avaliarRegras, aplicarDecisoes } from '../src/core/regras.js';

const FIXTURE = new URL('../fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx', import.meta.url).pathname;
const REF = '2026-10-19';

function cenario(ref = REF, mutar = (r) => r) {
  const plano = lerPlano(lerXlsx(FIXTURE), { arquivo: 'REV3.xlsx' });
  const registros = mutar(gerarRealizadoMock(plano, REF));
  const ents = entidadesDoRealizado(registros);
  const sugestoes = sugerirVinculos(ents, plano.linhas, {});
  const { vinculos } = aplicarSugestoes({}, sugestoes, 'media');
  const al = alocarRealizado(registros, plano.linhas, vinculos, ref);
  const { metricas } = calcularTudo(plano.linhas, al.alocacoes, ref);
  const alertas = avaliarRegras({
    metricas, flights: plano.flights, registros, orfaos: al.orfaos, foraDoPeriodo: al.foraDoPeriodo, vinculos,
    sugestoes: sugerirVinculos(ents, plano.linhas, vinculos), nomes: new Map(ents.map((e) => [e.chave, e])),
    justificativas: {}, ref, ultimaExtracao: ultimaExtracao(registros), alocacoesPorLinha: indexarAlocacoes(al.alocacoes),
  });
  return { plano, alertas, metricas };
}

test('o cenário de demonstração dispara as regras esperadas', () => {
  const { alertas } = cenario();
  const regras = new Set(alertas.map((a) => a.regra));
  for (const r of ['R01', 'R02', 'R04', 'R05', 'R06', 'R08', 'R11', 'R11u', 'R12', 'R15']) assert.ok(regras.has(r), `faltou ${r}`);
});

test('toda recomendação é executável: tem número e entidade', () => {
  const { alertas } = cenario();
  for (const a of alertas) {
    assert.ok(a.acao && /\d/.test(a.acao), `${a.id} sem número na ação: ${a.acao}`);
    assert.ok(a.entidade?.rotulo, `${a.id} sem entidade`);
    assert.ok(!a.acao.includes('{') && !a.mensagem.includes('{'), `${a.id} com placeholder não preenchido`);
  }
});

test('R01 recomenda a diária necessária calculada', () => {
  const { alertas, metricas } = cenario();
  const a = alertas.find((x) => x.regra === 'R01' && x.entidade.rotulo.includes('CARUARU'));
  const m = metricas.find((x) => x.linhaId === a.entidade.id);
  assert.equal(a.valores.diariaNecessaria, m.diariaNecessaria);
  assert.ok(a.complemento, 'aumento grande deve avisar catch-up arriscado');
});

test('dados desatualizados suspendem regras de ritmo e custo', () => {
  const { alertas } = cenario(REF, (rs) => rs.filter((r) => r.data <= '2026-10-15').map((r) => ({ ...r, dataExtracao: '2026-10-16T06:00:00-03:00' })));
  assert.ok(alertas.some((a) => a.regra === 'R13'));
  assert.ok(!alertas.some((a) => ['R01', 'R02', 'R06', 'R12'].includes(a.regra)));
});

test('decisões manuais: descartada some, adiada volta na data', () => {
  const { alertas } = cenario();
  const [a, b] = alertas;
  const com = aplicarDecisoes(alertas, { [a.id]: { estado: 'descartada', motivo: 'ok' }, [b.id]: { estado: 'adiada', ate: '2026-10-19' } }, REF);
  assert.equal(com.find((x) => x.id === a.id).estado, 'descartada');
  assert.equal(com.find((x) => x.id === b.id).estado, 'aberto');
});
