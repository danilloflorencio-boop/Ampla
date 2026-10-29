// Telas do monitor (HTML como string; eventos via delegação em app.js).
import { brl, pct, inteiro, decimal, dataBR, dataCurta, addDias } from '../core/format.js';
import { rotuloLinha, rotuloCurto } from '../core/plano.js';
import { configPlataforma } from '../config/config.js';
import { agregar } from '../core/pacing.js';
import { agruparPorCliente, podeGerirEquipe, foraDaMargem } from '../core/painel.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CONFIANCA = { alta: 'alta', media: 'média', baixa: 'baixa' };
const nomeMes = (iso) => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

export function chip(status) {
  return `<span class="chip s-${esc(status.codigo)}">${esc(status.rotulo)}</span>`;
}

/** Régua de ritmo: preenchido = % consumido; marcador = % que deveria ter sido gasto até ontem; faixa = ±tolerância. */
export function regua(x, { grande = false, tolerancia = 0.1 } = {}) {
  const inv = x.investimento || 0;
  const consumo = inv ? x.gasto / inv : 0;
  const tempo = inv ? x.planejadoAteOntem / inv : 0;
  const p = (v) => `${Math.max(0, Math.min(100, v * 100)).toFixed(2)}%`;
  const tmin = tempo * (1 - tolerancia), tmax = Math.min(1, tempo * (1 + tolerancia));
  const titulo = `Consumido ${pct(consumo)} · deveria estar em ${pct(tempo)} até ontem`;
  const rotulos = grande
    ? `<span class="rotulo-agora">deveria estar em ${pct(tempo)}</span><span class="rotulo-cheio">${pct(consumo)} usado</span>`
    : '';
  return `<div class="regua ${grande ? 'grande' : ''} s-${esc(x.status?.codigo || 'sem-dados')}" style="--consumo:${p(consumo)};--tempo:${p(tempo)};--tmin:${p(tmin)};--tmax:${p(tmax)}" role="img" aria-label="${esc(titulo)}" title="${esc(titulo)}">
    <span class="trilho"><span class="faixa"></span><span class="cheio"></span>${consumo > 1 ? '<span class="excesso"></span>' : ''}<span class="agora"></span></span>${rotulos}</div>`;
}

export function telaVazia() {
  return `<section class="vazio">
    <h2>Comece pelo plano de mídia</h2>
    <p>Importe a planilha do plano no formato Ampla (.xlsx exportado do Google Sheets). Cada aba vira um flight e a coluna “Investimento Plataforma R$” passa a ser a verba monitorada. Depois, suba o realizado das plataformas em CSV ou gere dados de demonstração.</p>
    <div class="botoes">
      <button class="btn btn-primario" data-acao="importar-plano">Importar plano (.xlsx)</button>
      <button class="btn" data-acao="abrir-demo">Abrir demonstração (SEBRAE PE)</button>
      <button class="btn btn-leve" data-acao="importar-workspace">Importar workspace (.json)</button>
    </div>
  </section>`;
}

const ABAS_GERAIS = ['painel', 'equipe'];

export function topo(ctx, painel) {
  const { db, ws, ref, estado } = ctx;
  const doCliente = !ABAS_GERAIS.includes(estado.aba);
  const clientes = Object.values(db.clientes).sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  const abertos = ctx.alertas.filter((a) => a.estado === 'aberto');
  const criticos = abertos.filter((a) => a.severidade === 'critico').length;
  const pend = ctx.pendenciasVinculo;
  const aba = (id, rotulo, contador, quente) => `<button role="tab" data-aba="${id}" aria-selected="${estado.aba === id}">${rotulo}${contador ? `<span class="contador ${quente ? 'quente' : ''}">${contador}</span>` : ''}</button>`;
  const ext = ctx.ultimaExtracao;
  const velho = ctx.alertas.some((a) => a.regra === 'R13');
  return `<header class="topo">
    <div class="topo-linha">
      <div class="marca-app"><h1>Monitor de pacing</h1><span>Ampla · mídia</span></div>
      <label class="campo">Data de referência <input type="date" value="${esc(ref)}" data-acao-change="trocar-ref"></label>
      ${doCliente ? `<div class="frescor ${velho ? 'velho' : ''}" title="Data da extração mais recente do realizado deste cliente"><i></i>${ext ? `Dados extraídos em ${esc(ext.replace('T', ' ').slice(0, 16))}` : ws?.realizado?.length ? 'Sem data de extração' : 'Sem realizado carregado'}</div>` : ''}
      <label class="campo">Você é
        <select data-acao-change="trocar-usuario"><option value="">Selecione</option>${[...db.equipe.pessoas].filter((x) => x.email).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => `<option value="${esc(x.email)}" ${x.email === db.preferencias.usuario ? 'selected' : ''}>${esc(x.nome || x.email)}</option>`).join('')}</select></label>
      <div class="acoes-topo">
        ${doCliente ? '<button class="btn" data-acao="importar-realizado">Subir realizado</button>' : ''}
        <button class="btn btn-leve" data-acao="importar-plano">Importar plano</button>
      </div>
    </div>
    <nav class="abas" role="tablist">
      ${aba('painel', 'Painel', painel?.placar.comAviso || '', painel?.placar.comAviso > 0)}
      ${podeGerirEquipe(db.equipe, db.preferencias.usuario) ? aba('equipe', 'Equipe e avisos', painel?.avisos.avisos.length || '') : aba('equipe', '<span aria-hidden="true">🔒</span> Equipe e avisos')}
      <span class="abas-sep" aria-hidden="true"></span>
      <label class="abas-cliente">Cliente
        <select data-acao-change="trocar-cliente">${clientes.map((c) => `<option value="${esc(c.clienteId)}" ${c.clienteId === ws?.clienteId ? 'selected' : ''}>${esc(c.cliente)}</option>`).join('')}</select></label>
      ${aba('alertas', 'Alertas', abertos.length, criticos > 0)}
      ${aba('vinculos', 'Vínculos', pend || '', pend > 0)}
      ${aba('plano', 'Plano e dados', ctx.plano.avisos.filter((a) => a.severidade !== 'info').length || '')}
    </nav>
  </header>`;
}

// ---------------------------------------------------------------- painel (todas as contas)
const SENTIDO = { acima: { seta: '▲', rotulo: 'Acima' }, abaixo: { seta: '▼', rotulo: 'Abaixo' }, 'no-ritmo': { seta: '●', rotulo: 'No ritmo' } };
const nomeDe = (equipe, email) => equipe.pessoas.find((p) => p.email === email)?.nome || '';
const pp = (v) => `${v >= 0 ? '+' : '−'}${decimal(Math.abs(v) * 100)} p.p.`;
const desvioTexto = (d) => (d === null || d === undefined ? '—' : `${d >= 0 ? '+' : '−'}${pct(Math.abs(d), 1)}`);

/** Barra de desvio centrada no plano: à esquerda (fria) abaixo, à direita (quente) acima. Faixa = margem. */
function barraDesvio(desvio, margem) {
  if (desvio === null || desvio === undefined) return '<span class="q-mudo">—</span>';
  const teto = 0.5;
  const w = (Math.min(Math.abs(desvio), teto) / teto) * 50;
  const titulo = `${desvioTexto(desvio)} contra o previsto até ontem · margem ±${pct(margem, 0)}`;
  return `<span class="desvio ${desvio < 0 ? 'abaixo' : 'acima'}" style="--w:${w.toFixed(1)}%;--m:${((margem / teto) * 50).toFixed(1)}%" role="img" aria-label="${esc(titulo)}" title="${esc(titulo)}"><span class="desvio-faixa"></span><span class="desvio-barra"></span><span class="desvio-centro"></span></span>`;
}

function statusPainel(c) {
  if (c.situacao !== 'ativa' || !c.sentido) return `<span class="q-status q-neutro">${esc(c.status.rotulo)}</span>`;
  const s = SENTIDO[c.sentido];
  return `<span class="q-status q-${c.sentido}"><b aria-hidden="true">${s.seta}</b>${s.rotulo}</span>`;
}

export function telaPainel(p, estado, db) {
  const { placar: pl } = p;
  const margem = p.cfg.avisos.margem;
  const f = estado.filtroPainel;
  const equipe = db.equipe;
  const pessoas = [...equipe.pessoas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const lideres = pessoas.filter((x) => equipe.pessoas.some((y) => y.lider === x.email));
  const opt = (lista, valor) => lista.map((o) => `<option value="${esc(o.v)}" ${o.v === valor ? 'selected' : ''}>${esc(o.r)}</option>`).join('');
  const sel = (nome, rotulo, lista, valor, todos = 'Todos') => `<label class="campo">${rotulo}<select data-filtro-painel="${nome}"><option value="">${todos}</option>${opt(lista, valor)}</select></label>`;
  const clientes = [...new Map(p.contas.map((c) => [c.clienteId, c.cliente])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([v, r]) => ({ v, r }));
  const plataformas = [...new Map(p.contas.map((c) => [c.plataforma, c.plataformaNome])).entries()].map(([v, r]) => ({ v, r }));
  const grupos = agruparPorCliente(p.filtradas, p.cfg);
  const ticker = [...p.contas].filter((c) => c.situacao === 'ativa' && c.indice !== null && c.sentido)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
    .map((c) => `<span class="t-item t-${c.sentido}"><b>${esc(c.cliente)}</b> ${esc(c.plataformaNome)} <i>${decimal(c.indice)}</i> ${SENTIDO[c.sentido].seta} ${desvioTexto(c.desvio)}</span>`).join('');
  const botao = (clienteId, plataforma, rotulo) => `<button class="btn btn-mini q-botao" data-abrir-cliente="${esc(clienteId)}" data-plataforma="${esc(plataforma)}" aria-label="Visão geral de ${esc(rotulo)}">Visão geral</button>`;
  const linhaConta = (c) => `<tr class="q-conta ${c.fora.length ? 'q-com-aviso' : ''}">
      <td class="q-nome"><div class="q-nome-linha"><div><span class="q-plat">${esc(c.plataformaNome)}</span>${c.contas.length ? `<span class="q-sub">${esc(c.contas.join(', '))}</span>` : ''}</div>${botao(c.clienteId, c.plataforma, `${c.cliente} · ${c.plataformaNome}`)}</div></td>
      <td class="q-analista">${esc(nomeDe(equipe, c.analista) || '—')}</td>
      <td class="num">${brl(c.investimento)}</td><td class="num">${brl(c.planejadoAteOntem)}</td><td class="num">${brl(c.gasto)}</td>
      <td class="num q-indice">${c.indice === null ? '—' : decimal(c.indice)}</td>
      <td class="num q-osc ${c.oscilacao > 0 ? 'sobe' : c.oscilacao < 0 ? 'desce' : ''}">${c.oscilacao === null ? '—' : `${c.oscilacao >= 0 ? '▲' : '▼'} ${pp(c.oscilacao)}`}</td>
      <td>${barraDesvio(c.desvio, margem)}</td>
      <td class="num">${brl(c.projecaoFim)}</td>
      <td class="num">${c.proximoFim ? `${dataCurta(c.proximoFim)}<span class="q-sub">${c.diasParaFim === 1 ? 'acaba hoje' : `faltam ${c.diasParaFim} d`}</span>` : '—'}</td>
      <td>${statusPainel(c)}${c.fora.length ? `<span class="q-aviso" title="${c.fora.length} linha(s) fora da margem a ${p.cfg.avisos.diasParaFim} dias ou menos do fim: aviso no chat">Aviso · ${c.fora.length}</span>` : ''}</td>
    </tr>`;
  const linhas = grupos.map((g) => {
    const t = g.total;
    return `<tr class="q-cliente"><td class="q-nome"><div class="q-nome-linha"><div><span class="q-cliente-nome">${esc(g.cliente)}</span><span class="q-sub">${esc(g.analistas.map((e) => nomeDe(equipe, e) || e).join(', ') || 'sem analista')} · ${g.contas.length} conta(s)</span></div>${botao(g.clienteId, '', g.cliente)}</div></td><td></td>
      <td class="num">${brl(t.investimento)}</td><td class="num">${brl(t.planejadoAteOntem)}</td><td class="num">${brl(t.gasto)}</td>
      <td class="num q-indice">${t.indice === null ? '—' : decimal(t.indice)}</td><td></td><td>${barraDesvio(t.desvio, margem)}</td><td class="num">${brl(t.projecaoFim)}</td><td></td>
      <td>${t.sentido ? `<span class="q-status q-${t.sentido}"><b aria-hidden="true">${SENTIDO[t.sentido].seta}</b>${SENTIDO[t.sentido].rotulo}</span>` : ''}</td></tr>
      ${g.contas.map(linhaConta).join('')}`;
  }).join('');
  const temFiltro = Object.values(f).some(Boolean);
  return `<section class="quadro" aria-labelledby="t-quadro">
    <div class="quadro-cabeca">
      <div><h2 id="t-quadro">Painel de pacing</h2>
        <p>Todas as contas, só pacing. Valores das linhas em veiculação, com dados até ${dataCurta(addDias(p.ref, -1))}. Margem de ±${pct(margem, 0)}; o chat avisa quando uma linha sai dela a ${p.cfg.avisos.diasParaFim} dias ou menos do fim.</p></div>
      <div class="quadro-relogio"><span>Referência</span><b>${dataBR(p.ref)}</b></div>
    </div>
    ${ticker ? `<div class="ticker" aria-label="Contas ordenadas pelo maior desvio"><div class="ticker-trilho">${ticker}<span aria-hidden="true" class="ticker-copia">${ticker}</span></div></div>` : ''}
    <dl class="placar">
      <div><dt>Contas em veiculação</dt><dd>${pl.ativas}<small>de ${pl.contas}</small></dd></div>
      <div class="p-ok"><dt>No ritmo</dt><dd>${pl.noRitmo}</dd></div>
      <div class="p-acima"><dt>Acima</dt><dd>${pl.acima}</dd></div>
      <div class="p-abaixo"><dt>Abaixo</dt><dd>${pl.abaixo}</dd></div>
      <div class="p-aviso"><dt>Avisos no chat</dt><dd>${pl.comAviso}<small>${pl.linhasComAviso} linha(s)</small></dd></div>
      ${pl.desatualizadas ? `<div class="p-velho"><dt>Dados desatualizados</dt><dd>${pl.desatualizadas}<small>conta(s) sem aviso até a carga chegar</small></dd></div>` : ''}
      <div class="p-saude ${pl.saudeSentido ? `p-${pl.saudeSentido}` : ''}" title="${esc(`${brl(pl.gasto)} usados de ${brl(pl.planejadoAteOntem)} previstos até ${dataCurta(addDias(p.ref, -1))}`)}"><dt>Saúde geral</dt><dd>${pl.saude === null ? '—' : pct(pl.saude, 0)}</dd><small>do previsto até ${dataCurta(addDias(p.ref, -1))} · 100% = no ritmo</small></div>
    </dl>
    <div class="quadro-filtros">
      ${sel('analista', 'Contas de', pessoas.map((x) => ({ v: x.email, r: x.nome })), f.analista, 'Toda a Ampla')}
      ${sel('lideranca', 'Time de', lideres.map((x) => ({ v: x.email, r: x.nome })), f.lideranca, 'Todas as lideranças')}
      ${sel('cliente', 'Cliente', clientes, f.cliente)}
      ${sel('plataforma', 'Plataforma', plataformas, f.plataforma, 'Todas')}
      ${sel('situacao', 'Situação', [{ v: 'fora', r: 'Com aviso no chat' }, { v: 'acima', r: 'Acima do ritmo' }, { v: 'abaixo', r: 'Abaixo do ritmo' }, { v: 'no-ritmo', r: 'No ritmo' }], f.situacao, 'Todas')}
      ${temFiltro ? '<button class="btn btn-mini q-limpar" data-acao="limpar-filtros-painel">Limpar filtros</button>' : ''}
    </div>
    ${grupos.length ? `<div class="rolagem"><table class="quadro-tabela">
      <thead><tr><th>Cliente · conta</th><th>Analista</th><th class="num">Investimento</th><th class="num">Previsto até ontem</th><th class="num">Usado</th><th class="num">Índice</th><th class="num">Osc. dia</th><th>Desvio</th><th class="num">Projeção</th><th class="num">Fim</th><th>Status</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>` : `<p class="quadro-vazio">Nenhuma conta com esses filtros.${pessoas.length ? '' : ' Cadastre a equipe em “Equipe e avisos” para filtrar por analista.'}</p>`}
    <p class="quadro-nota">Índice = usado ÷ previsto até ontem (1,00 = no ritmo). Osc. dia = variação do índice em relação ao dia anterior. O botão “Visão geral” abre o cliente ou a conta.</p>
  </section>`;
}

// ---------------------------------------------------------------- equipe e avisos
const PAPEL = { analista: 'analista', lideranca: 'liderança direta' };

/** Prévia das mensagens do Operações Bot (também usada na página de teste). */
export function previaAvisos(p, { link = '', acoes = true } = {}) {
  const { avisos, semResponsavel, desatualizadas } = p.avisos;
  return `<section class="bloco"><div class="cabeca-bloco"><div><h2>Prévia dos avisos de ${dataCurta(p.ref)} (${avisos.length})</h2>
      <p class="sub">O que o Operações Bot enviaria hoje. Quem não tem linha fora da margem não recebe nada.</p></div>
      ${acoes ? `<div class="acoes-topo"><button class="btn btn-mini" data-acao="exportar-avisos" ${avisos.length ? '' : 'disabled'}>Exportar avisos (.json)</button><button class="btn btn-mini" data-acao="exportar-tudo">Exportar workspace completo</button></div>` : ''}</div>
    ${semResponsavel.length ? `<div class="aviso atencao">${semResponsavel.length} conta(s) com linhas fora da margem não têm analista cadastrado e não geram aviso: ${esc(semResponsavel.map((c) => `${c.cliente} · ${c.plataformaNome}`).join(', '))}.</div>` : ''}
    ${desatualizadas.length ? `<div class="aviso atencao">${desatualizadas.length} conta(s) em veiculação estão com o realizado desatualizado e não geram aviso até a carga chegar: ${esc(desatualizadas.map((c) => `${c.cliente} · ${c.plataformaNome}${c.ultimoDiaDados ? ` (dados até ${dataCurta(c.ultimoDiaDados)})` : ' (sem realizado)'}`).join(', '))}.</div>` : ''}
    ${link ? '' : '<div class="aviso info">Sem link do monitor: as mensagens saem sem o endereço.</div>'}
    ${avisos.length ? `<div class="chat-lista">${avisos.map((a, i) => `<article class="chat">
      <div class="chat-avatar" aria-hidden="true">OB</div>
      <div class="chat-corpo"><div class="chat-meta"><b>Operações Bot</b> <span class="chat-app">App</span> <span class="mudo">para ${esc(a.nome)} · ${PAPEL[a.papel]}</span></div>
        <div class="chat-balao">${esc(a.texto)}</div>
        <button class="btn btn-leve btn-mini" data-copiar-aviso="${i}">Copiar texto</button></div>
    </article>`).join('')}</div>` : '<div class="silencio"><b>Tudo dentro da margem.</b> Nenhuma linha está fora de ±10% perto do fim: hoje o chat fica em silêncio.</div>'}
  </section>`;
}

/** Área da liderança fechada para quem não é liderança. */
export function telaBloqueada() {
  return `<section class="vazio bloqueio">
    <h2><span aria-hidden="true">🔒</span> Área da liderança</h2>
    <p>Equipe e avisos guarda o cadastro do time, o analista de cada cliente e a prévia do que o Operações Bot envia no chat. Só a liderança acessa.</p>
    <p>Se você é liderança, escolha seu nome em “Você é”, no topo da página.</p>
  </section>`;
}

/**
 * Responsável por conta: a liderança escolhe o analista padrão de cada cliente e, se quiser,
 * um analista diferente para cada conta (plataforma). É quem recebe os avisos daquela conta.
 */
export function tabelaResponsaveis(contas, db) {
  const pessoas = [...db.equipe.pessoas].filter((x) => x.email).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const opcoes = (valor, vazio) => `<option value="">${esc(vazio)}</option>${pessoas.map((x) => `<option value="${esc(x.email)}" ${x.email === valor ? 'selected' : ''}>${esc(x.nome || x.email)}</option>`).join('')}`;
  const porCliente = new Map();
  for (const c of contas) {
    if (!porCliente.has(c.clienteId)) porCliente.set(c.clienteId, []);
    porCliente.get(c.clienteId).push(c);
  }
  const linhas = [...porCliente.entries()].sort((a, b) => a[1][0].cliente.localeCompare(b[1][0].cliente, 'pt-BR')).map(([id, lista]) => {
    const ws = db.clientes[id];
    const padrao = ws?.analista || '';
    const nomePadrao = pessoas.find((x) => x.email === padrao)?.nome;
    return `<tr class="resp-cliente"><td><b>${esc(lista[0].cliente)}</b><span class="vg-sub">analista padrão do cliente</span></td>
        <td><select data-analista-cliente="${esc(id)}" aria-label="Analista padrão de ${esc(lista[0].cliente)}">${opcoes(padrao, 'Sem analista')}</select></td></tr>
      ${lista.map((c) => `<tr><td class="recuo-1">${esc(c.plataformaNome)}${c.fora.length ? ' <span class="vg-aviso">aviso hoje</span>' : ''}</td>
        <td><select data-analista-conta="${esc(id)}|${esc(c.plataforma)}" aria-label="Analista da conta ${esc(c.cliente)} · ${esc(c.plataformaNome)}">${opcoes(ws?.analistaPorConta?.[c.plataforma] || '', `Igual ao cliente${nomePadrao ? ` (${nomePadrao})` : ''}`)}</select></td></tr>`).join('')}`;
  }).join('');
  return `<section class="bloco"><h2>Responsável por conta</h2>
    <p class="sub">Associe cada conta a um analista: é ele quem recebe os avisos dela, e a conta aparece em “Contas de” no painel. Sem associação, vale o analista padrão do cliente.</p>
    ${linhas ? `<div class="rolagem"><table class="dados tabela-resp"><thead><tr><th>Cliente · conta</th><th>Analista</th></tr></thead><tbody>${linhas}</tbody></table></div>` : '<p class="mudo">Nenhum cliente importado.</p>'}
  </section>`;
}

export function telaEquipe(p, db) {
  if (!podeGerirEquipe(db.equipe, db.preferencias.usuario)) return telaBloqueada();
  const pessoas = db.equipe.pessoas;
  const opcoesPessoa = (valor, vazio, lista = pessoas) => `<option value="">${vazio}</option>${lista.filter((x) => x.email).map((x) => `<option value="${esc(x.email)}" ${x.email === valor ? 'selected' : ''}>${esc(x.nome || x.email)}</option>`).join('')}`;
  const link = db.preferencias.linkPainel || '';
  return `<div class="grade grade-2" style="margin-top:0">
    <section class="bloco"><h2>Como os avisos funcionam</h2>
      <p class="sub">O monitor é consultivo: ninguém precisa abrir o app todo dia. O Operações Bot avisa no Google Chat só quando uma linha em veiculação está fora da margem de <b>±${pct(p.cfg.avisos.margem, 0)}</b> e faltam <b>${p.cfg.avisos.diasParaFim} dias ou menos</b> para ela acabar. Antes disso, a oscilação é natural.</p>
      <ul class="lista-simples">
        <li><b>Analista da conta</b>: cada linha fora da margem, com o valor a configurar na plataforma (orçamento diário ou total, conforme o conjunto) e o prazo.</li>
        <li><b>Liderança direta</b>: um overview das contas do time com linhas fora da margem.</li>
      </ul>
      <label class="campo campo-largo">Link do monitor publicado (vai na mensagem)
        <input type="url" value="${esc(link)}" placeholder="https://…/monitor-pacing/" data-acao-change="link-painel"></label>
      <p class="dica">Margem e janela ficam em src/config/config.js (avisos.margem e avisos.diasParaFim).</p>
    </section>
    <section class="bloco"><h2>Equipe (${pessoas.length})</h2>
      <p class="sub">Quem é liderança e quem é liderança direta de quem fica no cadastro abaixo.</p>
      <ul class="lista-simples">${pessoas.filter((x) => x.email).map((x) => `<li><b>${esc(x.nome || x.email)}</b>${x.lideranca ? ' · liderança' : ''}${x.lider ? ` · responde a ${esc(pessoas.find((y) => y.email === x.lider)?.nome || x.lider)}` : ''}</li>`).join('') || '<li>Ninguém cadastrado ainda.</li>'}</ul>
    </section>
  </div>
  <div style="margin-top:20px">${tabelaResponsaveis(p.contas, db)}</div>
  <section class="bloco" style="margin-top:20px"><div class="cabeca-bloco"><div><h2>Cadastro da equipe</h2><p class="sub">Analistas e lideranças. Só quem está marcado como liderança (ou é liderança direta de alguém) abre esta área. As mudanças são salvas na hora.</p></div>
      <button class="btn btn-mini" data-acao="adicionar-pessoa">Adicionar pessoa</button></div>
    ${pessoas.length ? `<div class="rolagem"><table class="dados"><thead><tr><th>Nome</th><th>E-mail (Google Chat)</th><th>Liderança</th><th>Liderança direta</th><th></th></tr></thead><tbody>
      ${pessoas.map((x, i) => `<tr><td><input type="text" value="${esc(x.nome)}" data-pessoa="${i}" data-campo="nome" placeholder="Nome e sobrenome" aria-label="Nome"></td>
        <td><input type="email" value="${esc(x.email)}" data-pessoa="${i}" data-campo="email" placeholder="nome@ampla.com.br" aria-label="E-mail"></td>
        <td><label class="marcar"><input type="checkbox" data-pessoa="${i}" data-campo="lideranca" ${x.lideranca ? 'checked' : ''}> Liderança</label></td>
        <td><select data-pessoa="${i}" data-campo="lider" aria-label="Liderança direta">${opcoesPessoa(x.lider, 'Sem liderança')}</select></td>
        <td><button class="btn btn-leve btn-mini" data-remover-pessoa="${i}">Remover</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="mudo">Ninguém cadastrado ainda.</p>'}
  </section>
  <div style="margin-top:20px">${previaAvisos(p, { link })}</div>`;
}

// ---------------------------------------------------------------- visão geral (de um cliente)
/**
 * Visão geral enxuta de um cliente: só as linhas em veiculação (os mesmos números do painel),
 * quatro números, a régua, um gráfico e a lista de linhas. Abre pelo botão "Visão geral" do painel.
 */
export function visaoGeral(ctx, { detalhes = true } = {}) {
  const { ref, ws, filtros, opcoes, cfg } = ctx;
  const ativas = ctx.metricas.filter((m) => m.situacao === 'ativa');
  const t = agregar(ativas, cfg);
  const plat = filtros.plataforma;
  const seletor = `<label class="campo">Plataforma<select data-filtro="plataforma"><option value="">Todas</option>${opcoes.plataformas.map((o) => `<option value="${esc(o.v)}" ${o.v === plat ? 'selected' : ''}>${esc(configPlataforma(o.v).nome)}</option>`).join('')}</select></label>`;
  const topo = `<div class="vg-topo">
      <button class="btn" data-aba="painel"><span aria-hidden="true">←</span> Voltar ao painel</button>
      <div class="vg-titulo"><h2>${esc(ws.cliente)}</h2><p>${plat ? esc(configPlataforma(plat).nome) : 'Todas as plataformas'} · linhas em veiculação · dados até ${dataCurta(addDias(ref, -1))}</p></div>
      ${seletor}
    </div>`;
  if (!ativas.length) {
    return `<section class="vg">${topo}<section class="vazio"><h2>Nenhuma linha em veiculação</h2><p>${ws.realizado.length ? 'As linhas deste filtro já acabaram ou ainda não começaram.' : 'Ainda não há realizado carregado para este cliente.'}</p></section></section>`;
  }
  const desvio = t.indice === null ? null : t.indice - 1;
  const projDesvio = t.desvioProjetado;
  const linhas = [...ativas].sort((a, b) => a.linha.fim.localeCompare(b.linha.fim)).map((m) => `<tr>
      <td class="nome">${esc(rotuloCurto(m.linha) || rotuloLinha(m.linha))}<span class="vg-sub">${esc(configPlataforma(m.linha.plataforma).nome)}</span></td>
      <td>${dataCurta(m.linha.fim)}<span class="vg-sub">${m.diasRestantes === 1 ? 'acaba hoje' : `faltam ${m.diasRestantes} d`}</span></td>
      <td class="num">${brl(m.gasto)}<span class="vg-sub">de ${brl(m.planejadoAteOntem)}</span></td>
      <td class="num forte">${m.indice === null ? '—' : decimal(m.indice)}</td>
      <td>${chip(m.status)}${foraDaMargem(m, cfg) ? '<span class="vg-aviso">Aviso no chat</span>' : ''}</td>
      ${detalhes ? `<td><button class="btn btn-mini" data-detalhe="${esc(m.linhaId)}">Detalhes</button></td>` : ''}</tr>`).join('');
  return `<section class="vg">${topo}
    <dl class="vg-cartoes">
      <div><dt>Investimento</dt><dd>${brl(t.investimento)}</dd><small>${ativas.length} linha(s) em veiculação</small></div>
      <div><dt>Usado até ontem</dt><dd>${brl(t.gasto)}</dd><small>previsto: ${brl(t.planejadoAteOntem)}</small></div>
      <div class="vg-ritmo s-${esc(t.status.codigo)}"><dt>Ritmo</dt><dd>${t.indice === null ? '—' : decimal(t.indice)}</dd><small>${chip(t.status)}${desvio === null ? '' : ` ${desvio >= 0 ? '+' : '−'}${pct(Math.abs(desvio), 0)}`}</small></div>
      <div><dt>Projeção até o fim</dt><dd>${brl(t.projecaoFim)}</dd><small>${projDesvio === null ? '' : `${projDesvio >= 0 ? '+' : '−'}${pct(Math.abs(projDesvio), 0)} do investimento`}</small></div>
    </dl>
    <section class="bloco">${regua(t, { grande: true, tolerancia: cfg.avisos.margem })}</section>
    <section class="bloco"><h2>Verba acumulada</h2><p class="sub">Linha tracejada: o previsto. Linha cheia: o usado. Pontilhada: para onde vai no ritmo atual. Faixa verde: ±${pct(cfg.avisos.margem, 0)}.</p><div class="grafico"><canvas id="g-geral-acum"></canvas></div></section>
    <section class="bloco"><h2>Linhas em veiculação</h2>
      <div class="rolagem"><table class="dados"><thead><tr><th>Linha</th><th>Fim</th><th class="num">Usado / previsto</th><th class="num">Índice</th><th>Status</th>${detalhes ? '<th></th>' : ''}</tr></thead><tbody>${linhas}</tbody></table></div>
    </section>
  </section>`;
}

// ---------------------------------------------------------------- alertas
const ROTULO_SEV = { critico: 'Crítico', atencao: 'Atenção', info: 'Informativo' };
const ROTULO_ESTADO = { aceita: 'Aceita', descartada: 'Descartada', adiada: 'Adiada' };

export function cartaoAlerta(a, compacto = false) {
  const fechado = a.estado !== 'aberto';
  const linkLinha = a.entidade.tipo === 'linha' ? ` <button class="btn btn-leve btn-mini" data-detalhe="${esc(a.entidade.id)}">Abrir linha</button>` : '';
  return `<article class="alerta sev-${a.severidade} ${fechado ? 'fechado' : ''}">
    <div class="meta">${ROTULO_SEV[a.severidade]} · regra ${esc(a.regra)}${fechado ? ` · ${ROTULO_ESTADO[a.estado] || a.estado}` : ''}</div>
    <h3>${esc(a.titulo)}</h3>
    <p>${esc(a.mensagem)}</p>
    <div class="acao"><strong>O que fazer</strong>${esc(a.acao)}</div>
    ${a.complemento ? `<p class="complemento">${esc(a.complemento)}</p>` : ''}
    ${compacto ? '' : `<div class="botoes">
      ${fechado ? `<button class="btn btn-mini" data-decidir="reabrir" data-id="${esc(a.id)}">Reabrir</button>` : `
      <button class="btn btn-mini" data-decidir="aceita" data-id="${esc(a.id)}">Aceitar</button>
      <button class="btn btn-mini" data-decidir="adiada" data-id="${esc(a.id)}">Adiar 1 dia</button>
      <button class="btn btn-mini" data-decidir="descartada" data-id="${esc(a.id)}">Descartar…</button>`}
      <button class="btn btn-leve btn-mini" data-copiar="${esc(a.id)}">Copiar ação</button>${linkLinha}
    </div>`}
    ${a.decisao ? `<div class="decisao">${esc(ROTULO_ESTADO[a.decisao.estado] || a.decisao.estado)} em ${esc((a.decisao.em || '').slice(0, 10))}${a.decisao.motivo ? ` — ${esc(a.decisao.motivo)}` : ''}${a.decisao.ate ? ` (até ${esc(dataCurta(a.decisao.ate))})` : ''}</div>` : ''}
  </article>`;
}

export function telaAlertas(ctx) {
  const f = ctx.estado.filtroAlertas;
  const lista = ctx.alertasFiltrados.filter((a) => (f.estado === 'todos' || (f.estado === 'aberto' ? a.estado === 'aberto' : a.estado !== 'aberto'))
    && (!f.severidade || a.severidade === f.severidade) && (!f.regra || a.regra === f.regra));
  const regras = [...new Set(ctx.alertasFiltrados.map((a) => a.regra))].sort();
  const cont = (s) => ctx.alertasFiltrados.filter((a) => a.estado === 'aberto' && a.severidade === s).length;
  return `<section>
    <div class="cabeca-bloco" style="margin-bottom:14px">
      <div class="filtros" style="padding:0;margin:0">
        <label class="campo">Mostrar<select data-filtro-alerta="estado"><option value="aberto" ${f.estado === 'aberto' ? 'selected' : ''}>Abertos</option><option value="fechado" ${f.estado === 'fechado' ? 'selected' : ''}>Aceitos, adiados e descartados</option><option value="todos" ${f.estado === 'todos' ? 'selected' : ''}>Todos</option></select></label>
        <label class="campo">Severidade<select data-filtro-alerta="severidade"><option value="">Todas</option><option value="critico" ${f.severidade === 'critico' ? 'selected' : ''}>Crítico (${cont('critico')})</option><option value="atencao" ${f.severidade === 'atencao' ? 'selected' : ''}>Atenção (${cont('atencao')})</option><option value="info" ${f.severidade === 'info' ? 'selected' : ''}>Informativo (${cont('info')})</option></select></label>
        <label class="campo">Regra<select data-filtro-alerta="regra"><option value="">Todas</option>${regras.map((r) => `<option ${f.regra === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      </div>
      <div class="acoes-topo"><button class="btn btn-mini" data-acao="copiar-acoes">Copiar ações abertas (review diário)</button></div>
    </div>
    ${lista.length ? `<div class="lista-alertas">${lista.map((a) => cartaoAlerta(a)).join('')}</div>` : '<section class="vazio"><h2>Nada por aqui</h2><p>Nenhum alerta com esses filtros. Alertas aceitos, adiados e descartados ficam em “Mostrar”.</p></section>'}
    <p class="dica">As regras são determinísticas (sem IA) e só disparam com dados suficientes. Catálogo, limiares e textos: docs/REGRAS.md, src/config/config.js e src/config/textos.js.</p>
  </section>`;
}

// ---------------------------------------------------------------- vínculos
export function telaVinculos(ctx) {
  const { entidades, ws, sugestoes } = ctx;
  const porId = new Map(ctx.plano.linhas.map((l) => [l.id, l]));
  const linhasSemVinculo = ctx.plano.linhas.filter((l) => !Object.values(ws.vinculos).some((v) => v.linhas.includes(l.id)));
  const sug = new Map(sugestoes.map((s) => [s.chave, s]));
  const altas = sugestoes.filter((s) => s.confianca === 'alta').length;
  const linhas = entidades.map((e) => {
    const v = ws.vinculos[e.chave];
    const s = sug.get(e.chave);
    const situacao = v ? `<span class="chip s-ok">Vinculado a ${v.linhas.length} linha(s)</span>`
      : s ? `<span class="chip s-atencao-under">Sugestão de confiança ${esc(CONFIANCA[s.confianca])}</span>` : '<span class="chip s-critico-over">Sem vínculo</span>';
    const alvo = (v?.linhas || s?.linhas || []).map((id) => porId.get(id)).filter(Boolean).map((l) => esc(rotuloLinha(l))).join('<br>');
    return `<tr><td class="nome"><span class="forte">${esc(e.conjuntoNome || e.conjuntoId)}</span><br><span class="mudo">${esc(e.campanhaNome)} · ${esc(e.plataforma)}${e.contaNome ? ` · ${esc(e.contaNome)}` : ''}</span></td>
      <td>${dataCurta(e.primeiroDia)} a ${dataCurta(e.ultimoDia)}</td><td class="num">${brl(e.gasto)}</td><td>${situacao}${s && !v ? `<div class="dica">${esc(s.motivos.join(', '))}</div>` : ''}</td>
      <td class="nome dica">${alvo || '—'}</td>
      <td><div class="acoes-topo">${!v && s ? `<button class="btn btn-mini" data-aceitar-sugestao="${esc(e.chave)}">Aceitar sugestão</button>` : ''}<button class="btn btn-mini" data-editar-vinculo="${esc(e.chave)}">${v ? 'Editar' : 'Vincular…'}</button>${v ? `<button class="btn btn-leve btn-mini" data-desvincular="${esc(e.chave)}">Desvincular</button>` : ''}</div></td></tr>`;
  });
  return `<section>
    <div class="cabeca-bloco" style="margin-bottom:12px">
      <p class="dica" style="margin:0;max-width:80ch">Cada conjunto da plataforma é ligado às linhas do plano. O mesmo conjunto pode atravessar vários flights: o gasto de cada dia vai para a linha ativa naquele dia (com rateio pela diária planejada quando há mais de uma). Padrão de nomes sugerido em docs/NOMENCLATURA.md.</p>
      ${altas ? `<button class="btn btn-primario btn-mini" data-acao="aceitar-altas">Aceitar ${altas} sugestão(ões) de alta confiança</button>` : ''}
    </div>
    ${entidades.length ? `<div class="rolagem"><table class="dados"><thead><tr><th>Conjunto / campanha</th><th>Período com gasto</th><th class="num">Gasto</th><th>Situação</th><th>Linhas do plano</th><th></th></tr></thead><tbody>${linhas.join('')}</tbody></table></div>`
      : '<section class="vazio"><h2>Sem realizado carregado</h2><p>Suba o CSV das plataformas para vincular os conjuntos ao plano.</p><div class="botoes"><button class="btn btn-primario" data-acao="importar-realizado">Subir realizado</button><button class="btn" data-acao="gerar-mock">Gerar dados de demonstração</button></div></section>'}
    <section class="bloco"><h2>Linhas do plano sem nenhum conjunto vinculado (${linhasSemVinculo.length})</h2>
      ${linhasSemVinculo.length ? `<ul>${linhasSemVinculo.map((l) => `<li>${esc(rotuloLinha(l))} <span class="mudo">${dataCurta(l.inicio)} a ${dataCurta(l.fim)} · ${brl(l.investimento)}</span></li>`).join('')}</ul>` : '<p class="mudo">Todas as linhas têm pelo menos um conjunto.</p>'}
    </section>
  </section>`;
}

export function dialogoVinculo(ctx, chave) {
  const e = ctx.entidades.find((x) => x.chave === chave);
  const atual = ctx.ws.vinculos[chave]?.linhas || ctx.sugestoes.find((s) => s.chave === chave)?.linhas || [];
  const pesos = ctx.ws.vinculos[chave]?.pesos || {};
  const linhas = [...ctx.plano.linhas].sort((a, b) => (a.produto + a.praca).localeCompare(b.produto + b.praca) || a.inicio.localeCompare(b.inicio));
  return `<h2>Vincular conjunto</h2>
    <p><span class="forte">${esc(e?.conjuntoNome || chave)}</span><br><span class="mudo">${esc(e?.campanhaNome || '')} · gasto ${brl(e?.gasto)} de ${dataCurta(e?.primeiroDia)} a ${dataCurta(e?.ultimoDia)}</span></p>
    <label class="campo" style="margin-bottom:8px">Filtrar linhas<input type="search" data-filtrar-lista placeholder="praça, produto ou código"></label>
    <div class="lista-check">${linhas.map((l) => `<label data-texto="${esc(rotuloLinha(l).toLowerCase())}"><input type="checkbox" name="linha" value="${esc(l.id)}" ${atual.includes(l.id) ? 'checked' : ''}>
      <span>${esc(rotuloLinha(l))}<br><span class="mudo">${dataCurta(l.inicio)} a ${dataCurta(l.fim)} · ${brl(l.investimento)} · diária ${brl(l.diariaPlan)}</span></span>
      <input type="number" min="0" step="1" name="peso:${esc(l.id)}" value="${esc(pesos[l.id] ?? '')}" placeholder="peso" style="width:70px;margin-left:auto" title="Peso de rateio quando mais de uma linha está ativa no mesmo dia (vazio = diária planejada)"></label>`).join('')}</div>
    <p class="dica">Peso vazio = rateio pela diária planejada. Use peso só quando o conjunto atende linhas ativas ao mesmo tempo em proporção diferente.</p>
    <div class="botoes"><button class="btn" value="cancelar" data-fechar-dialogo>Cancelar</button><button class="btn btn-primario" data-salvar-vinculo="${esc(chave)}">Salvar vínculo</button></div>`;
}

// ---------------------------------------------------------------- plano e dados
export function telaPlano(ctx) {
  const { plano, ws } = ctx;
  const sev = { critico: 0, atencao: 1, info: 2 };
  const avisos = [...plano.avisos].sort((a, b) => sev[a.severidade] - sev[b.severidade]);
  const regs = ws.realizado;
  const periodo = regs.length ? `${dataBR(regs[0].data)} a ${dataBR(regs.at(-1).data)}` : '—';
  const plats = [...new Set(regs.map((r) => r.plataforma))].join(', ') || '—';
  return `<div class="grade grade-2" style="margin-top:0">
    <section class="bloco"><h2>Plano de mídia</h2>
      <p class="sub">${esc(plano.arquivo || '')}${plano.versao ? ` · ${esc(plano.versao)}` : ''} · importado em ${esc(plano.importadoEm.slice(0, 16).replace('T', ' '))}</p>
      <div class="rolagem"><table class="dados"><thead><tr><th>Aba (flight)</th><th>Período do cabeçalho</th><th>Período das linhas</th><th class="num">Linhas</th><th class="num">Investimento plataforma</th></tr></thead>
      <tbody>${plano.flights.map((f) => `<tr><td>${esc(f.aba)}</td><td>${dataCurta(f.inicio)} a ${dataCurta(f.fim)}</td><td>${dataCurta(f.inicioEfetivo)} a ${dataCurta(f.fimEfetivo)}</td><td class="num">${f.linhaIds.length}</td><td class="num">${brl(f.investimento)}</td></tr>`).join('')}</tbody></table></div>
      <p class="dica">Valor monitorado: coluna “Investimento Plataforma R$” de cada linha. Os totais e o resumo da planilha servem só de conferência.</p>
      <div class="acoes-topo"><button class="btn btn-mini" data-acao="importar-plano">Importar nova versão</button></div>
    </section>
    <section class="bloco"><h2>Realizado</h2>
      <dl class="fatos" style="border:0;padding:0;margin:0 0 14px">
        <div><dt>Registros</dt><dd>${inteiro(regs.length)}</dd></div>
        <div><dt>Período</dt><dd style="font-size:16px">${periodo}</dd></div>
        <div><dt>Plataformas</dt><dd style="font-size:16px">${esc(plats)}</dd></div>
        <div><dt>Última extração</dt><dd style="font-size:16px">${esc((ctx.ultimaExtracao || '—').replace('T', ' ').slice(0, 16))}</dd></div>
      </dl>
      <div class="acoes-topo">
        <button class="btn btn-mini" data-acao="importar-realizado">Subir CSV</button>
        <button class="btn btn-mini" data-acao="gerar-mock">Gerar demonstração</button>
        <button class="btn btn-mini" data-acao="exportar-realizado" ${regs.length ? '' : 'disabled'}>Exportar CSV canônico</button>
        <button class="btn btn-leve btn-mini" data-acao="limpar-realizado" ${regs.length ? '' : 'disabled'}>Apagar realizado</button>
      </div>
      <h2 style="margin-top:20px">Workspace</h2>
      <p class="sub">Tudo fica neste navegador. Para passar a outro analista, exporte e importe o arquivo .json.</p>
      <div class="acoes-topo">
        <button class="btn btn-mini" data-acao="exportar-workspace">Exportar workspace</button>
        <button class="btn btn-mini" data-acao="importar-workspace">Importar workspace</button>
        <button class="btn btn-leve btn-mini" data-acao="remover-cliente">Remover cliente</button>
      </div>
    </section>
  </div>
  <section class="bloco" style="margin-top:20px"><h2>Validação do plano (${avisos.length})</h2>
    <p class="sub">Problemas encontrados na planilha. Nenhum bloqueia o monitor; corrija na origem quando puder.</p>
    ${avisos.map((a) => `<div class="aviso ${a.severidade}"><code>${esc(a.codigo)} · ${esc(a.aba)}</code><br>${esc(a.mensagem)}</div>`).join('') || '<p class="mudo">Nenhum problema encontrado.</p>'}
  </section>`;
}

export function dialogoDiff(diff, arquivo) {
  const item = (l) => `<li>${esc(rotuloLinha(l))} <span class="mudo">${brl(l.investimento)}</span></li>`;
  return `<h2>Nova versão do plano</h2><p>${esc(arquivo)} substitui o plano atual deste cliente. Vínculos, decisões e notas são mantidos para as linhas que continuam.</p>
    <p><b>${diff.novas.length}</b> linha(s) nova(s), <b>${diff.removidas.length}</b> removida(s), <b>${diff.alteradas.length}</b> alterada(s).</p>
    ${diff.alteradas.length ? `<details open><summary>Alteradas</summary><ul>${diff.alteradas.map((a) => `<li>${esc(rotuloLinha(a.linha))}: ${a.campos.map((c) => `${esc(c.campo)} ${esc(c.campo === 'investimento' || c.campo === 'custoUnitPlan' ? brl(c.de) : c.de)} → ${esc(c.campo === 'investimento' || c.campo === 'custoUnitPlan' ? brl(c.para) : c.para)}`).join('; ')}</li>`).join('')}</ul></details>` : ''}
    ${diff.novas.length ? `<details><summary>Novas</summary><ul>${diff.novas.map(item).join('')}</ul></details>` : ''}
    ${diff.removidas.length ? `<details><summary>Removidas</summary><ul>${diff.removidas.map(item).join('')}</ul></details>` : ''}
    <div class="botoes"><button class="btn" data-fechar-dialogo>Cancelar</button><button class="btn btn-primario" data-acao="confirmar-plano">Substituir plano</button></div>`;
}

export function dialogoRealizado(info) {
  return `<h2>Subir realizado</h2>
    <p>${esc(info.arquivo)}: ${inteiro(info.registros.length)} registro(s) reconhecido(s)${info.periodo ? `, de ${esc(info.periodo)}` : ''}.</p>
    ${info.avisos.map((a) => `<div class="aviso atencao">${esc(a)}</div>`).join('')}
    ${info.colunasNaoReconhecidas.length ? `<p class="dica">Colunas ignoradas: ${esc(info.colunasNaoReconhecidas.join(', '))}.</p>` : ''}
    ${info.semPlataforma ? `<label class="campo">O arquivo não tem coluna de plataforma. Qual é?<select name="plataforma-padrao"><option>META ADS</option><option>GOOGLE ADS</option><option>TIKTOK ADS</option><option>PINTEREST ADS</option><option>LINKEDIN ADS</option></select></label>` : ''}
    <p class="dica">Recarregar o mesmo dia substitui os números anteriores (não duplica).</p>
    <div class="botoes"><button class="btn" data-fechar-dialogo>Cancelar</button><button class="btn btn-primario" data-acao="confirmar-realizado" ${info.registros.length ? '' : 'disabled'}>Carregar ${inteiro(info.registros.length)} registro(s)</button></div>`;
}

// ---------------------------------------------------------------- painel da linha
export function painelLinha(ctx, linhaId) {
  const m = ctx.metricasTodas.find((x) => x.linhaId === linhaId);
  if (!m) return '';
  const l = m.linha;
  const alertas = ctx.alertas.filter((a) => a.entidade.id === linhaId || a.entidade.id.includes(linhaId));
  const notas = ctx.ws.notas.filter((n) => n.linhaId === linhaId);
  const just = ctx.ws.justificativas[linhaId] || '';
  return `<div class="painel-fundo" data-fechar-painel></div>
  <aside class="painel" role="dialog" aria-label="Detalhe da linha">
    <header><div><h2>${esc(rotuloLinha(l))}</h2><div class="dica">${esc(l.aba)} · linha ${l.linhaPlanilha} da planilha · ${esc(l.plataforma)} · ${esc(l.formato)}</div></div>
      <button class="btn btn-leve" data-fechar-painel aria-label="Fechar">Fechar</button></header>
    <section class="bloco">${chip(m.status)}${regua(m, { grande: true })}
      <dl class="fatos" style="margin-top:6px">
        <div><dt>Investimento plataforma</dt><dd>${brl(l.investimento)}<small>${dataCurta(l.inicio)} a ${dataCurta(l.fim)} · ${l.dias} dias · diária ${brl(l.diariaPlan)}</small></dd></div>
        <div><dt>Usado até ontem</dt><dd>${brl(m.gasto)}<small>planejado até ontem ${brl(m.planejadoAteOntem)} · índice ${m.indice === null ? '—' : decimal(m.indice)}</small></dd></div>
        <div><dt>Diária necessária</dt><dd>${m.diariaNecessaria ? brl(m.diariaNecessaria) : '—'}<small>média 7d ${brl(m.media)} · ${m.diasRestantes} dia(s) restante(s)</small></dd></div>
        <div><dt>Projeção</dt><dd>${brl(m.projecaoFim)}<small>${m.dataEsgotamento ? `esgota em ${dataCurta(m.dataEsgotamento)}` : 'sem esgotamento previsto'}</small></dd></div>
      </dl>
      <p class="dica">Turma: ${esc(l.dataTurmaTexto.replace(/\s*\n\s*/g, ' / ') || '—')} · código ${esc(l.codigoRaw || '—')} · segmentação: ${esc(l.segmentacao || '—')}</p>
    </section>
    <section class="bloco"><h2>Verba acumulada</h2><div class="grafico baixo"><canvas id="g-painel-acum"></canvas></div></section>
    <section class="bloco"><h2>Gasto diário</h2><div class="grafico baixo"><canvas id="g-painel-dia"></canvas></div></section>
    <section class="bloco"><h2>Conjuntos (${m.entidades.length})</h2>
      ${m.entidades.length ? `<div class="rolagem"><table class="dados"><thead><tr><th>Conjunto</th><th class="num">Gasto alocado</th><th class="num">Dias</th><th class="num">Orçamento config.</th></tr></thead><tbody>
      ${m.entidades.map((e) => { const n = ctx.nomes.get(e.chave); return `<tr><td class="nome">${esc(n?.conjuntoNome || e.chave)}<br><span class="mudo">${esc(n?.campanhaNome || '')}</span></td><td class="num">${brl(e.gasto)}</td><td class="num">${e.dias}</td><td class="num">${e.orcamentoDiario ? brl(e.orcamentoDiario) : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="mudo">Nenhum conjunto vinculado. Vá em Vínculos.</p>'}</section>
    <section class="bloco"><h2>Alertas desta linha (${alertas.length})</h2>${alertas.length ? `<div class="lista-alertas">${alertas.map((a) => cartaoAlerta(a)).join('')}</div>` : '<p class="mudo">Nenhum alerta.</p>'}</section>
    <section class="bloco"><h2>Justificativa de desvio</h2><p class="sub">O plano exige causa + ação para desvios acima de ±10%. Aparece no report e desliga o alerta R14.</p>
      <textarea data-justificativa="${esc(linhaId)}" placeholder="Causa: … Ação: …">${esc(just)}</textarea>
      <div class="botoes" style="margin-top:8px"><button class="btn btn-mini" data-salvar-justificativa="${esc(linhaId)}">Salvar justificativa</button></div></section>
    <section class="bloco"><h2>Notas (${notas.length})</h2>
      ${notas.map((n) => `<div class="aviso info"><code>${esc(n.quando.slice(0, 16).replace('T', ' '))}</code><br>${esc(n.texto)}</div>`).join('')}
      <textarea data-nota="${esc(linhaId)}" placeholder="Ex.: agência parceira trocou criativo em 15/10"></textarea>
      <div class="botoes" style="margin-top:8px"><button class="btn btn-mini" data-salvar-nota="${esc(linhaId)}">Adicionar nota</button></div></section>
  </aside>`;
}

export { agregar };
