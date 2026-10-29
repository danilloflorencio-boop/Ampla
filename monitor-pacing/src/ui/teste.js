// Página de teste do painel de pacing (teste-painel.html). Dados fictícios de src/demo/cenarios.js.
// Mostra o painel, o roteiro de casos com a conferência (✓/✗) e a prévia dos avisos do chat,
// com a área de avisos bloqueada para quem não é liderança, como no monitor.
import { brl, dataCurta } from '../core/format.js';
import { montarPainel, filtrarPainel, podeGerirEquipe } from '../core/painel.js';
import { montarAvisos } from '../core/avisos.js';
import { configDoCliente } from '../config/config.js';
import { montarCenario, conferirRoteiro } from '../demo/cenarios.js';
import * as V from './views.js';

const FILTRO_VAZIO = { analista: '', lideranca: '', cliente: '', plataforma: '', situacao: '' };
const LINK = 'https://monitor.exemplo/monitor-pacing/';
const estado = { cenario: 'problemas', usuario: 'helena.prado@exemplo.com', filtroPainel: { ...FILTRO_VAZIO } };
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
  const cfg = configDoCliente({ avisos: { linkPainel: LINK } });
  const painel = montarPainel(c.workspaces, c.ref);
  const avisos = montarAvisos(painel.contas, c.equipe, c.ref, cfg);
  return {
    c, db: { equipe: c.equipe, clientes: Object.fromEntries(c.workspaces.map((w) => [w.clienteId, w])), preferencias: { usuario: estado.usuario } },
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
      <p class="sub">Cada linha do plano fictício simula um caso. A última coluna confere, com o mesmo cálculo do monitor, se o painel e o chat fazem o esperado.</p></div></div>
    <div class="rolagem"><table class="dados"><thead><tr><th>Cliente · conta</th><th>Linha</th><th class="num">Investimento</th><th>O que simula</th><th>Esperado</th><th>Resultado</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`;
}

function render() {
  atual = calcular();
  const { c, db, p, roteiro } = atual;
  const pessoas = [...c.equipe.pessoas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pode = podeGerirEquipe(c.equipe, estado.usuario);
  const botao = (id, rotulo) => `<button class="btn ${estado.cenario === id ? 'btn-primario' : ''}" data-cenario="${id}" aria-pressed="${estado.cenario === id}">${rotulo}</button>`;
  document.querySelector('#app').innerHTML = `
  <header class="topo"><div class="topo-linha">
    <div class="marca-app"><h1>Página de teste · Painel de pacing</h1><span>dados fictícios · referência ${dataCurta(c.ref)}/2026</span></div>
    <div class="acoes-topo" role="group" aria-label="Cenário">${botao('problemas', 'Com problemas')}${botao('tudo-certo', 'Tudo no ritmo')}</div>
    <label class="campo">Você é<select data-usuario>${pessoas.map((x) => `<option value="${V.esc(x.email)}" ${x.email === estado.usuario ? 'selected' : ''}>${V.esc(x.nome)}${x.lideranca ? ' (liderança)' : ''}</option>`).join('')}</select></label>
  </div></header>
  <main class="principal-geral">
    <p class="teste-intro">${estado.cenario === 'problemas'
      ? '<b>Com problemas:</b> 12 clientes fictícios com contas acima, abaixo, verba consumida, conjunto parado, orçamento total, dado desatualizado e cliente sem analista. Troque “Você é” para ver o painel e a área de avisos do ponto de vista de cada pessoa.'
      : '<b>Tudo no ritmo:</b> a mesma carteira com cada linha no ritmo e o dado em dia. O painel fica verde e o chat não envia nada.'}</p>
    ${V.telaPainel(p, estado, db)}
    <div style="margin-top:20px">${pode ? V.previaAvisos(p, { link: LINK, acoes: false }) : V.telaBloqueada()}</div>
    <div style="margin-top:20px">${tabelaRoteiro(roteiro)}</div>
  </main>`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-cenario],[data-abrir-cliente],[data-copiar-aviso],[data-acao]');
  if (!el) return;
  const d = el.dataset;
  if (d.cenario) { estado.cenario = d.cenario; estado.filtroPainel = { ...FILTRO_VAZIO }; return render(); }
  if (d.abrirCliente) {
    estado.filtroPainel = { ...FILTRO_VAZIO, cliente: d.abrirCliente, plataforma: d.plataforma || '' };
    render();
    return toast('Na página de teste, o botão mostra só essa conta. No monitor, ele abre a visão geral.');
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
  if (el.hasAttribute('data-usuario')) {
    estado.usuario = el.value;
    const lider = atual.c.equipe.pessoas.find((x) => x.email === el.value)?.lideranca;
    estado.filtroPainel = { ...FILTRO_VAZIO, ...(lider ? { lideranca: el.value } : { analista: el.value }) };
    render();
  }
});

render();
