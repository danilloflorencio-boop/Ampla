// Página de teste do painel de pacing (teste-painel.html): "como ficaria" o monitor com uma
// carteira de 12 clientes fictícios (src/demo/cenarios.js). Painel, visão geral pelo botão,
// equipe e avisos (só liderança, com a associação de cada conta a um analista) e o roteiro de
// casos com a conferência (✓/✗). Nada é salvo: recarregar a página volta ao início.
import { brl, dataCurta } from '../core/format.js';
import { montarPainel, filtrarPainel, podeGerirEquipe, ehLideranca } from '../core/painel.js';
import { montarAvisos } from '../core/avisos.js';
import { contextoCliente } from '../core/cliente.js';
import { series } from '../core/pacing.js';
import { configDoCliente } from '../config/config.js';
import { montarCenario, conferirRoteiro } from '../demo/cenarios.js';
import { graficoAcumulado, destruirGraficos } from './charts.js';
import * as V from './views.js';

const FILTRO_VAZIO = { analista: '', lideranca: '', cliente: '', plataforma: '', situacao: '' };
const LINK = 'https://monitor.exemplo/monitor-pacing/';
const estado = {
  cenario: 'problemas',
  tela: 'painel',              // painel · geral · equipe
  usuario: 'helena.prado@exemplo.com',
  filtroPainel: { ...FILTRO_VAZIO },
  cliente: null, plataforma: '',
  atribuicoes: {},             // clienteId → { analista?, contas: { plataforma: email } } (feitas pela liderança)
};
let atual = null;

const ESPERADO = {
  diario: 'Aviso: ajustar o orçamento diário',
  total: 'Aviso: ajustar o orçamento total',
  indefinido: 'Aviso: diário, com o total equivalente',
  parado: 'Aviso: conferir a entrega (conjunto parado)',
  esgotada: 'Aviso: pausar (verba consumida)',
};
function esperado(e) {
  if (e.semResponsavel) return 'Fora da margem, sem destinatário';
  if (e.aviso) return ESPERADO[e.acao];
  if (e.desatualizado) return 'Sem aviso: dados desatualizados';
  if (e.agendada) return 'Sem aviso: agendada';
  if (e.encerrada) return 'Sem aviso: encerrada';
  return 'Sem aviso';
}

function calcular() {
  const c = montarCenario(estado.cenario);
  for (const w of c.workspaces) {
    const a = estado.atribuicoes[w.clienteId];
    if (!a) continue;
    if ('analista' in a) w.analista = a.analista || null;
    w.analistaPorConta = { ...a.contas };
  }
  const cfg = configDoCliente({ avisos: { linkPainel: LINK } });
  const painel = montarPainel(c.workspaces, c.ref);
  const avisos = montarAvisos(painel.contas, c.equipe, c.ref, cfg);
  const db = { equipe: c.equipe, clientes: Object.fromEntries(c.workspaces.map((w) => [w.clienteId, w])), preferencias: { usuario: estado.usuario } };
  return {
    c, db,
    p: { ...painel, cfg, filtradas: filtrarPainel(painel.contas, estado.filtroPainel, c.equipe), avisos },
    roteiro: conferirRoteiro(c.roteiro, painel, avisos),
  };
}

function tabelaRoteiro(roteiro) {
  const ok = roteiro.filter((r) => r.ok).length;
  const linhas = roteiro.map((r) => `<tr class="${r.ok ? '' : 'falhou'}">
    <td>${V.esc(r.cliente)}<span class="vg-sub">${V.esc(r.conta.plataformaNome)}</span></td>
    <td>${V.esc(r.produto)} · ${V.esc(r.praca)}</td>
    <td class="num">${brl(r.investimento)}</td>
    <td>${V.esc(r.simula)}</td>
    <td>${V.esc(esperado(r.espera))}</td>
    <td class="${r.ok ? 'ok' : 'erro'}">${r.ok ? '✓ conferido' : '✗ diferente'}</td></tr>`).join('');
  return `<section class="bloco teste-roteiro"><div class="cabeca-bloco"><div><h2>Roteiro do teste (${ok} de ${roteiro.length} conferidos)</h2>
      <p class="sub">Cada linha do plano fictício simula um caso. A última coluna confere, com o mesmo cálculo do monitor, se o painel e o chat fazem o esperado. Mudanças em “Responsável por conta” não alteram o roteiro, só para quem vai cada aviso.</p></div></div>
    <div class="rolagem"><table class="dados"><thead><tr><th>Cliente · conta</th><th>Linha</th><th class="num">Investimento</th><th>O que simula</th><th>Esperado</th><th>Resultado</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`;
}

function conteudo() {
  const { c, db, p, roteiro } = atual;
  if (estado.tela === 'geral') {
    const ctx = contextoCliente(db.clientes[estado.cliente], c.ref, { plataforma: estado.plataforma });
    return ctx ? V.visaoGeral(ctx, { detalhes: false }) : '';
  }
  if (estado.tela === 'equipe') {
    if (!podeGerirEquipe(c.equipe, estado.usuario)) return V.telaBloqueada();
    return `${V.tabelaResponsaveis(p.contas, db)}<div style="margin-top:20px">${V.previaAvisos(p, { link: LINK, acoes: false })}</div>`;
  }
  return `<p class="teste-intro">${estado.cenario === 'problemas'
    ? '<b>Com problemas:</b> 12 clientes fictícios com contas acima, abaixo, verba consumida, conjunto parado, orçamento total, dado desatualizado e cliente sem analista. Troque “Você é” para ver o painel do ponto de vista de cada pessoa; a liderança associa as contas aos analistas em “Equipe e avisos”.'
    : '<b>Tudo no ritmo:</b> a mesma carteira com cada linha no ritmo e o dado em dia. O painel fica verde e o chat não envia nada.'}</p>
    ${V.telaPainel(p, estado, db)}
    <div style="margin-top:20px">${tabelaRoteiro(roteiro)}</div>`;
}

function render() {
  destruirGraficos();
  atual = calcular();
  const { c, p } = atual;
  const pessoas = [...c.equipe.pessoas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pode = podeGerirEquipe(c.equipe, estado.usuario);
  const botao = (id, rotulo) => `<button class="btn ${estado.cenario === id ? 'btn-primario' : ''}" data-cenario="${id}" aria-pressed="${estado.cenario === id}">${rotulo}</button>`;
  const aba = (id, rotulo, contador, quente) => `<button role="tab" data-tela="${id}" aria-selected="${estado.tela === id}">${rotulo}${contador ? `<span class="contador ${quente ? 'quente' : ''}">${contador}</span>` : ''}</button>`;
  document.querySelector('#app').innerHTML = `
  <header class="topo"><div class="topo-linha">
    <div class="marca-app"><h1>Monitor de pacing · teste</h1><span>dados fictícios · referência ${dataCurta(c.ref)}/2026</span></div>
    <div class="acoes-topo" role="group" aria-label="Cenário">${botao('problemas', 'Com problemas')}${botao('tudo-certo', 'Tudo no ritmo')}</div>
    <label class="campo">Você é<select data-usuario>${pessoas.map((x) => `<option value="${V.esc(x.email)}" ${x.email === estado.usuario ? 'selected' : ''}>${V.esc(x.nome)}${x.lideranca ? ' (liderança)' : ''}</option>`).join('')}</select></label>
  </div>
  <nav class="abas" role="tablist">
    ${aba('painel', 'Painel', p.placar.comAviso || '', p.placar.comAviso > 0)}
    ${pode ? aba('equipe', 'Equipe e avisos', p.avisos.avisos.length || '') : aba('equipe', '<span aria-hidden="true">🔒</span> Equipe e avisos')}
  </nav></header>
  <main class="principal-geral">${conteudo()}</main>`;
  if (estado.tela === 'geral') requestAnimationFrame(() => {
    const ctx = contextoCliente(atual.db.clientes[estado.cliente], c.ref, { plataforma: estado.plataforma });
    const ativas = ctx?.metricas.filter((m) => m.situacao === 'ativa') || [];
    if (ativas.length) graficoAcumulado(document.querySelector('#g-geral-acum'), series(ativas, c.ref, ctx.cfg));
  });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function atribuicao(clienteId) {
  if (!estado.atribuicoes[clienteId]) estado.atribuicoes[clienteId] = { contas: {} };
  return estado.atribuicoes[clienteId];
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-cenario],[data-tela],[data-aba],[data-abrir-cliente],[data-copiar-aviso],[data-acao]');
  if (!el) return;
  const d = el.dataset;
  if (d.cenario) { estado.cenario = d.cenario; estado.filtroPainel = { ...FILTRO_VAZIO }; estado.tela = 'painel'; return render(); }
  if (d.tela || d.aba === 'painel') { estado.tela = d.tela || 'painel'; render(); return window.scrollTo({ top: 0 }); }
  if (d.abrirCliente) {
    estado.cliente = d.abrirCliente; estado.plataforma = d.plataforma || ''; estado.tela = 'geral';
    render(); return window.scrollTo({ top: 0 });
  }
  if (d.copiarAviso !== undefined) {
    const a = atual.p.avisos.avisos[Number(d.copiarAviso)];
    try { await navigator.clipboard.writeText(a.texto); toast('Copiado.'); } catch { toast('Não foi possível copiar.'); }
    return;
  }
  if (d.acao === 'limpar-filtros-painel') { estado.filtroPainel = { ...FILTRO_VAZIO }; return render(); }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.filtroPainel !== undefined) { estado.filtroPainel[el.dataset.filtroPainel] = el.value; return render(); }
  if (el.dataset.filtro === 'plataforma') { estado.plataforma = el.value; return render(); }
  if (el.dataset.analistaCliente !== undefined || el.dataset.analistaConta !== undefined) {
    if (!podeGerirEquipe(atual.c.equipe, estado.usuario)) { toast('Área da liderança.'); return render(); }
    if (el.dataset.analistaCliente !== undefined) atribuicao(el.dataset.analistaCliente).analista = el.value;
    else {
      const [clienteId, plataforma] = el.dataset.analistaConta.split('|');
      const a = atribuicao(clienteId);
      if (el.value) a.contas[plataforma] = el.value; else delete a.contas[plataforma];
    }
    render();
    return toast('Conta associada. O painel e a prévia dos avisos já usam o novo responsável.');
  }
  if (el.hasAttribute('data-usuario')) {
    estado.usuario = el.value;
    estado.filtroPainel = { ...FILTRO_VAZIO, ...(ehLideranca(atual.c.equipe, el.value) ? { lideranca: el.value } : { analista: el.value }) };
    render();
  }
});

render();
