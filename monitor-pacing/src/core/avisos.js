// Avisos de pacing para o Google Chat (entregues pelo Operações Bot).
// O monitor é consultivo: ninguém precisa abrir o app todo dia. O chat só fala quando uma
// linha ativa está fora da margem perto do fim (ver foraDaMargem em painel.js).
//   • analista: por conta, o estado do pacing, o link do monitor e, por linha fora da margem,
//     o valor a configurar na plataforma (diário ou total, conforme o orçamento do conjunto);
//   • liderança direta: um overview das contas do time que têm linhas fora da margem.
// Quem não tem nada fora da margem não recebe mensagem.

import { brl, pct, decimal, dataCurta, addDias } from './format.js';
import { rotuloLinha } from './plano.js';
import { t } from '../config/textos.js';
import { CONFIG_PADRAO } from '../config/config.js';

const icone = (desvio) => `${Math.abs(desvio) > 0.2 ? '🔴' : '🟡'} ${desvio > 0 ? '🔺' : '🔻'}`;
const iconeConta = (c) => (c.sentido === 'no-ritmo' || c.desvio === null ? '🟡' : icone(c.desvio));
const sinal = (desvio) => `${desvio > 0 ? '+' : '−'}${pct(Math.abs(desvio), 0)}`;
const reaisComSinal = (v) => `${v >= 0 ? '+' : '−'}${brl(Math.abs(v))}`;
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

/** Link do monitor já aberto na conta (o app lê o filtro do endereço). */
export function linkDaConta(base, conta) {
  if (!base) return '';
  const q = new URLSearchParams({ cliente: conta.clienteId, plataforma: conta.plataforma });
  return `${base.replace(/#.*$/, '')}#${q.toString()}`;
}

/** Como a conta está, para o cabeçalho: "está muito acima do previsto (+32%)". */
export function estadoDaConta(conta, cfg = CONFIG_PADRAO) {
  const d = conta.desvio;
  if (d === null || conta.sentido === 'no-ritmo') return t('AVISO_ESTADO', 'misto', { n: conta.fora.length, margem: pct(cfg.avisos.margem, 0), desvio: d === null ? '—' : sinal(d) });
  const muito = Math.abs(d) > cfg.status.atencao;
  const chave = d > 0 ? (muito ? 'muitoAcima' : 'acima') : (muito ? 'muitoAbaixo' : 'abaixo');
  return t('AVISO_ESTADO', chave, { desvio: sinal(d) });
}

/** Texto de uma linha fora da margem, com o ajuste a fazer na plataforma. */
export function textoLinha(m) {
  const desvio = m.indice - 1;
  const a = m.ajuste;
  const vars = {
    icone: icone(desvio), entidade: rotuloLinha(m.linha),
    gasto: brl(m.gasto), planejado: brl(m.planejadoAteOntem), indice: decimal(m.indice), desvio: `${sinal(desvio)} ${desvio > 0 ? 'acima' : 'abaixo'} do previsto`,
    prazo: m.diasRestantes === 1 ? 'acaba hoje' : `faltam ${m.diasRestantes} dias`, fim: dataCurta(m.linha.fim), investimento: brl(m.investimento),
    excedente: brl(Math.max(0, m.gasto - m.investimento)),
    atual: `${brl(a.atual)}${a.origemAtual === 'media' ? ' (média dos últimos dias)' : ''}`,
    novo: brl(a.novo), variacao: a.variacao === null ? '—' : reaisComSinal(a.variacao), total: brl(a.total),
    conjuntos: a.nConjuntos > 1 ? `dos ${a.nConjuntos} conjuntos (somados)` : 'do conjunto',
  };
  const acao = a.tipo === 'esgotada' ? 'esgotada' : a.tipo === 'total' ? 'total' : m.media === 0 ? 'parado' : a.tipo;
  return `${t('AVISO_LINHA', 'item', vars)}\n${t('AVISO_LINHA', acao, vars)}`;
}

/**
 * Monta as mensagens do dia.
 * @param {object[]} contas   saída de montarPainel(...).contas
 * @param {{ pessoas: { nome, email, lider }[] }} equipe
 * @param {string} ref        data de referência
 * @returns {{ avisos: { para, nome, papel, texto, contas, linhas }[], semResponsavel: object[], desatualizadas: object[] }}
 */
export function montarAvisos(contas, equipe, ref, cfg = CONFIG_PADRAO) {
  const pessoas = new Map((equipe?.pessoas || []).map((p) => [p.email, p]));
  const comAviso = contas.filter((c) => c.fora.length);
  const base = cfg.avisos.linkPainel;
  const comuns = {
    data: dataCurta(ref), ontem: dataCurta(addDias(ref, -1)), amanha: dataCurta(addDias(ref, 1)),
    margem: pct(cfg.avisos.margem, 0), janela: cfg.avisos.diasParaFim,
  };
  const link = (url) => (url ? ` (${url})` : '');
  const avisos = [];
  const semResponsavel = comAviso.filter((c) => !c.analista || !pessoas.has(c.analista));

  // ---------- analistas: um bloco por conta, uma ação por linha ----------
  const porAnalista = new Map();
  for (const c of comAviso) {
    if (!pessoas.has(c.analista)) continue;
    if (!porAnalista.has(c.analista)) porAnalista.set(c.analista, []);
    porAnalista.get(c.analista).push(c);
  }
  for (const [email, lista] of porAnalista) {
    const p = pessoas.get(email);
    const blocos = lista.map((c) => [
      t('AVISO_ANALISTA', 'conta', { ...comuns, conta: `${c.cliente} · ${c.plataformaNome}`, estado: estadoDaConta(c, cfg), link: link(linkDaConta(base, c)) }),
      ...c.fora.map(textoLinha),
    ].join('\n\n'));
    const texto = [t('AVISO_ANALISTA', 'abertura', { nome: p.nome }), ...blocos, t('AVISO_ANALISTA', 'rodape', comuns)].join('\n\n');
    avisos.push({ para: email, nome: p.nome, papel: 'analista', texto, contas: lista.map((c) => c.id), linhas: lista.reduce((s, c) => s + c.fora.length, 0) });
  }

  // ---------- liderança direta: overview das contas do time ----------
  const porLider = new Map();
  for (const c of comAviso) {
    const lider = pessoas.get(c.analista)?.lider;
    if (!lider || !pessoas.has(lider)) continue;
    if (!porLider.has(lider)) porLider.set(lider, []);
    porLider.get(lider).push(c);
  }
  for (const [email, lista] of porLider) {
    const p = pessoas.get(email);
    const blocos = lista.map((c) => {
      const vars = {
        ...comuns, icone: iconeConta(c), conta: `${c.cliente} · ${c.plataformaNome}`, analista: primeiroNome(pessoas.get(c.analista)?.nome),
        estado: estadoDaConta(c, cfg), nFora: c.fora.length,
        projecao: brl(c.projecaoFim), investimento: brl(c.investimento), fim: dataCurta(c.ultimoFim),
      };
      return `${t('AVISO_LIDERANCA', 'conta', vars)}\n${t('AVISO_LIDERANCA', 'acao', vars)}`;
    });
    const texto = [
      t('AVISO_LIDERANCA', 'abertura', { nome: p.nome }),
      t('AVISO_LIDERANCA', 'resumo', { ...comuns, n: lista.length, link: link(base) }),
      ...blocos,
    ].join('\n\n');
    avisos.push({ para: email, nome: p.nome, papel: 'lideranca', texto, contas: lista.map((c) => c.id), linhas: lista.reduce((s, c) => s + c.fora.length, 0) });
  }
  // contas ativas com dado parado: ficam fora dos avisos (falso alarme) e aparecem na prévia
  const desatualizadas = contas.filter((c) => c.situacao === 'ativa' && c.desatualizado);
  return { avisos, semResponsavel, desatualizadas };
}
