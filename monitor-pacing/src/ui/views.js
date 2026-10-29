// Telas do monitor (HTML como string; eventos via delegação em app.js).
import { brl, pct, inteiro, decimal, dataBR, dataCurta, diffDias, addDias } from '../core/format.js';
import { rotuloLinha, rotuloFlight } from '../core/plano.js';
import { agruparPor, agregar } from '../core/pacing.js';
import { agruparPorCliente } from '../core/painel.js';

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
  const { db, ws, ref, filtros, opcoes, estado } = ctx;
  const doCliente = !ABAS_GERAIS.includes(estado.aba);
  const clientes = Object.values(db.clientes).sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  const sel = (nome, rotulo, lista, valor) => `<label class="campo">${rotulo}
    <select data-filtro="${nome}"><option value="">Todos</option>${lista.map((o) => `<option value="${esc(o.v)}" ${o.v === valor ? 'selected' : ''}>${esc(o.r)}</option>`).join('')}</select></label>`;
  const abertos = ctx.alertas.filter((a) => a.estado === 'aberto');
  const criticos = abertos.filter((a) => a.severidade === 'critico').length;
  const pend = ctx.pendenciasVinculo;
  const aba = (id, rotulo, contador, quente) => `<button role="tab" data-aba="${id}" aria-selected="${estado.aba === id}">${rotulo}${contador ? `<span class="contador ${quente ? 'quente' : ''}">${contador}</span>` : ''}</button>`;
  const ext = ctx.ultimaExtracao;
  const velho = ctx.alertas.some((a) => a.regra === 'R13');
  const nFiltros = Object.values(filtros).filter(Boolean).length;
  return `<header class="topo">
    <div class="topo-linha">
      <div class="marca-app"><h1>Monitor de pacing</h1><span>Ampla · mídia</span></div>
      <label class="campo">Data de referência <input type="date" value="${esc(ref)}" data-acao-change="trocar-ref"></label>
      ${doCliente ? `<div class="frescor ${velho ? 'velho' : ''}" title="Data da extração mais recente do realizado deste cliente"><i></i>${ext ? `Dados extraídos em ${esc(ext.replace('T', ' ').slice(0, 16))}` : ws?.realizado?.length ? 'Sem data de extração' : 'Sem realizado carregado'}</div>` : ''}
      <div class="acoes-topo">
        ${doCliente ? `<button class="btn btn-mini so-celular" data-acao="alternar-filtros" aria-expanded="${estado.filtrosAbertos}">Filtros${nFiltros ? ` (${nFiltros})` : ''}</button>
        <button class="btn" data-acao="importar-realizado">Subir realizado</button>` : ''}
        <button class="btn btn-leve" data-acao="importar-plano">Importar plano</button>
      </div>
    </div>
    ${doCliente ? `<div class="filtros ${estado.filtrosAbertos ? 'aberto' : ''}">
      ${sel('plataforma', 'Plataforma', opcoes.plataformas, filtros.plataforma)}
      ${sel('flight', 'Flight', opcoes.flights, filtros.flight)}
      ${sel('produto', 'Campanha / produto', opcoes.produtos, filtros.produto)}
      ${sel('praca', 'Praça', opcoes.pracas, filtros.praca)}
      ${sel('situacao', 'Situação', [{ v: 'ativa', r: 'Ativas' }, { v: 'encerrada', r: 'Encerradas' }, { v: 'agendada', r: 'Agendadas' }], filtros.situacao)}
      ${nFiltros ? '<button class="btn btn-leve btn-mini" data-acao="limpar-filtros">Limpar filtros</button>' : ''}
    </div>` : ''}
    <nav class="abas" role="tablist">
      ${aba('painel', 'Painel', painel?.placar.comAviso || '', painel?.placar.comAviso > 0)}
      ${aba('equipe', 'Equipe e avisos', painel?.avisos.avisos.length || '')}
      <span class="abas-sep" aria-hidden="true"></span>
      <label class="abas-cliente">Cliente
        <select data-acao-change="trocar-cliente">${clientes.map((c) => `<option value="${esc(c.clienteId)}" ${c.clienteId === ws?.clienteId ? 'selected' : ''}>${esc(c.cliente)}</option>`).join('')}</select></label>
      ${aba('geral', 'Visão geral')}
      ${aba('ritmo', 'Ritmo por linha')}
      ${aba('turmas', 'Turmas')}
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
  const indiceGeral = pl.planejadoAteOntem ? pl.gasto / pl.planejadoAteOntem : null;
  const ticker = [...p.contas].filter((c) => c.situacao === 'ativa' && c.indice !== null && c.sentido)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
    .map((c) => `<span class="t-item t-${c.sentido}"><b>${esc(c.cliente)}</b> ${esc(c.plataformaNome)} <i>${decimal(c.indice)}</i> ${SENTIDO[c.sentido].seta} ${desvioTexto(c.desvio)}</span>`).join('');
  const linhaConta = (c) => `<tr class="q-conta ${c.fora.length ? 'q-com-aviso' : ''}" data-abrir-cliente="${esc(c.clienteId)}" data-plataforma="${esc(c.plataforma)}" tabindex="0" title="Abrir ${esc(c.cliente)} · ${esc(c.plataformaNome)}">
      <td class="q-nome"><span class="q-plat">${esc(c.plataformaNome)}</span>${c.contas.length ? `<span class="q-sub">${esc(c.contas.join(', '))}</span>` : ''}</td>
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
    return `<tr class="q-cliente"><td class="q-nome" colspan="2"><button class="q-link" data-abrir-cliente="${esc(g.clienteId)}">${esc(g.cliente)}</button><span class="q-sub">${esc(nomeDe(equipe, g.analista) || 'sem analista')} · ${g.contas.length} conta(s)</span></td>
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
      <div><dt>Índice geral</dt><dd>${indiceGeral === null ? '—' : decimal(indiceGeral)}<small>${brl(pl.gasto)} de ${brl(pl.planejadoAteOntem)}</small></dd></div>
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
    <p class="quadro-nota">Índice = usado ÷ previsto até ontem (1,00 = no ritmo). Osc. dia = variação do índice em relação ao dia anterior. Clique numa conta para ver as linhas.</p>
  </section>`;
}

// ---------------------------------------------------------------- equipe e avisos
export function telaEquipe(p, db) {
  const equipe = db.equipe;
  const clientes = Object.values(db.clientes).sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  const pessoas = equipe.pessoas;
  const opcoesPessoa = (valor, vazio) => `<option value="">${vazio}</option>${pessoas.filter((x) => x.email).map((x) => `<option value="${esc(x.email)}" ${x.email === valor ? 'selected' : ''}>${esc(x.nome || x.email)}</option>`).join('')}`;
  const { avisos, semResponsavel, desatualizadas } = p.avisos;
  const papel = { analista: 'analista', lideranca: 'liderança direta' };
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
    <section class="bloco"><h2>Responsável por cliente</h2>
      <p class="sub">Quem recebe os avisos de cada cliente. A liderança direta vem do cadastro da equipe.</p>
      ${clientes.length ? `<div class="rolagem"><table class="dados"><thead><tr><th>Cliente</th><th>Analista</th></tr></thead><tbody>
        ${clientes.map((c) => `<tr><td>${esc(c.cliente)}</td><td><select data-analista-cliente="${esc(c.clienteId)}">${opcoesPessoa(c.analista, 'Sem analista')}</select></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="mudo">Nenhum cliente importado.</p>'}
    </section>
  </div>
  <section class="bloco" style="margin-top:20px"><div class="cabeca-bloco"><div><h2>Equipe (${pessoas.length})</h2><p class="sub">Analistas e lideranças. As mudanças são salvas na hora.</p></div>
      <button class="btn btn-mini" data-acao="adicionar-pessoa">Adicionar pessoa</button></div>
    ${pessoas.length ? `<div class="rolagem"><table class="dados"><thead><tr><th>Nome</th><th>E-mail (Google Chat)</th><th>Liderança direta</th><th></th></tr></thead><tbody>
      ${pessoas.map((x, i) => `<tr><td><input type="text" value="${esc(x.nome)}" data-pessoa="${i}" data-campo="nome" placeholder="Nome e sobrenome" aria-label="Nome"></td>
        <td><input type="email" value="${esc(x.email)}" data-pessoa="${i}" data-campo="email" placeholder="nome@ampla.com.br" aria-label="E-mail"></td>
        <td><select data-pessoa="${i}" data-campo="lider" aria-label="Liderança direta">${opcoesPessoa(x.lider, 'Sem liderança')}</select></td>
        <td><button class="btn btn-leve btn-mini" data-remover-pessoa="${i}">Remover</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="mudo">Ninguém cadastrado ainda.</p>'}
  </section>
  <section class="bloco" style="margin-top:20px"><div class="cabeca-bloco"><div><h2>Prévia dos avisos de ${dataCurta(p.ref)} (${avisos.length})</h2>
      <p class="sub">O que o Operações Bot enviaria hoje. Quem não tem linha fora da margem não recebe nada.</p></div>
      <div class="acoes-topo"><button class="btn btn-mini" data-acao="exportar-avisos" ${avisos.length ? '' : 'disabled'}>Exportar avisos (.json)</button><button class="btn btn-mini" data-acao="exportar-tudo">Exportar workspace completo</button></div></div>
    ${semResponsavel.length ? `<div class="aviso atencao">${semResponsavel.length} conta(s) com linhas fora da margem não têm analista cadastrado e não geram aviso: ${esc(semResponsavel.map((c) => `${c.cliente} · ${c.plataformaNome}`).join(', '))}.</div>` : ''}
    ${desatualizadas.length ? `<div class="aviso atencao">${desatualizadas.length} conta(s) em veiculação estão com o realizado desatualizado e não geram aviso até a carga chegar: ${esc(desatualizadas.map((c) => `${c.cliente} · ${c.plataformaNome}${c.ultimoDiaDados ? ` (dados até ${dataCurta(c.ultimoDiaDados)})` : ' (sem realizado)'}`).join(', '))}.</div>` : ''}
    ${link ? '' : '<div class="aviso info">Sem link do monitor: as mensagens saem sem o endereço. Preencha o link acima.</div>'}
    ${avisos.length ? `<div class="chat-lista">${avisos.map((a, i) => `<article class="chat">
      <div class="chat-avatar" aria-hidden="true">OB</div>
      <div class="chat-corpo"><div class="chat-meta"><b>Operações Bot</b> <span class="chat-app">App</span> <span class="mudo">para ${esc(a.nome)} · ${papel[a.papel]}</span></div>
        <div class="chat-balao">${esc(a.texto)}</div>
        <button class="btn btn-leve btn-mini" data-copiar-aviso="${i}">Copiar texto</button></div>
    </article>`).join('')}</div>` : '<p class="mudo">Nenhuma linha fora da margem perto do fim. Hoje o chat fica em silêncio.</p>'}
  </section>`;
}

// ---------------------------------------------------------------- visão geral
export function visaoGeral(ctx) {
  const { total: t, ref, ws } = ctx;
  if (!ctx.metricas.length) return `<section class="vazio"><h2>Nenhuma linha com esses filtros</h2><p>Ajuste os filtros acima ou limpe-os para ver o plano inteiro.</p></section>`;
  const ontem = addDias(ref, -1);
  const deveria = t.investimento ? t.planejadoAteOntem / t.investimento : 0;
  const semRealizado = !ws.realizado.length;
  const frase = semRealizado
    ? `<b>${esc(ws.cliente)}</b> tem ${brl(t.investimento)} de investimento em plataforma no plano. Ainda não há realizado carregado.`
    : `Até ${dataCurta(ontem)}, <b>${esc(ws.cliente)}</b> usou <b>${brl(t.gasto)}</b> de ${brl(t.investimento)} em plataforma, quando o plano previa ${brl(t.planejadoAteOntem)} até aqui.`;
  const leitura = semRealizado ? 'Suba o CSV do realizado ou gere dados de demonstração para ver o ritmo.'
    : t.indice === null ? 'Nenhuma linha começou ainda.'
    : `Índice de ritmo ${decimal(t.indice)}: ${t.status.codigo === 'ok' ? 'dentro da tolerância de ±10% do plano' : t.status.codigo.endsWith('under') ? 'gastando menos do que o planejado' : 'gastando mais do que o planejado'}.`;
  const mes = nomeMes(ref);
  const ativas = ctx.metricas.filter((m) => m.situacao === 'ativa');
  const orfao = ctx.alloc.orfaos.reduce((s, r) => s + r.gasto, 0);
  const semVeic = ctx.metricas.filter((m) => m.status.codigo === 'sem-veiculacao').length;
  const porPlat = agruparPor(ctx.metricas, (m) => m.linha.plataforma, (m) => m.linha.plataforma);
  const topAlertas = ctx.alertasFiltrados.filter((a) => a.estado === 'aberto').slice(0, 5);
  return `
  <section class="abertura">
    <p class="frase">${frase}<small>${esc(leitura)} ${chip(t.status)}</small></p>
    ${regua(t, { grande: true })}
    <div class="legenda-regua"><span><span class="amostra-agora"></span>onde deveria estar até ontem</span><span><span class="amostra-faixa"></span>tolerância de ±10% do plano</span><span>cor fria = abaixo do ritmo · cor quente = acima</span></div>
    <dl class="fatos">
      <div><dt>Projeção até o fim dos flights</dt><dd>${brl(t.projecaoFim)}<small>${t.desvioProjetado === null ? '' : `${t.desvioProjetado >= 0 ? '+' : ''}${pct(t.desvioProjetado)} do plano · média dos últimos 7 dias`}</small></dd></div>
      <div><dt>Previsto até o fim de ${esc(mes)}</dt><dd>${brl(t.previstoNoMes)}<small>planejado no mês: ${brl(t.planejadoNoMes)} · usado: ${brl(t.gastoNoMes)}</small></dd></div>
      <div><dt>Diária de hoje (${ativas.length} linha${ativas.length === 1 ? '' : 's'} ativa${ativas.length === 1 ? '' : 's'})</dt><dd>${brl(t.diariaNecessaria)}<small>necessária · média atual ${brl(t.media)} · plano ${brl(t.diariaPlan)}</small></dd></div>
      <div><dt>Pendências de dados</dt><dd>${semVeic + (orfao > 0 ? 1 : 0)}<small>${semVeic} linha(s) sem veiculação · ${brl(orfao)} sem vínculo</small></dd></div>
    </dl>
  </section>
  <div class="grade grade-2">
    <section class="bloco"><h2>Verba acumulada</h2><p class="sub">Planejado ideal, realizado e projeção pela média dos últimos 7 dias. A faixa verde é a tolerância de ±10%.</p><div class="grafico"><canvas id="g-geral-acum"></canvas></div></section>
    <section class="bloco"><h2>Gasto diário</h2><p class="sub">Barras: gasto de cada dia. Linhas: diária planejada e, a partir de hoje, a diária necessária para fechar o plano.</p><div class="grafico"><canvas id="g-geral-dia"></canvas></div></section>
  </div>
  <div class="grade grade-2">
    <section class="bloco"><div class="cabeca-bloco"><div><h2>Alertas abertos</h2><p class="sub">Os mais graves primeiro. Cada um traz a ação com valor e prazo.</p></div><button class="btn btn-mini" data-aba="alertas">Ver todos</button></div>
      ${topAlertas.length ? `<div class="lista-alertas">${topAlertas.map((a) => cartaoAlerta(a, true)).join('')}</div>` : '<p class="mudo">Nenhum alerta aberto para esses filtros.</p>'}</section>
    <section class="bloco"><h2>Por plataforma</h2><p class="sub">Uma conta por plataforma, com todas as linhas do filtro.</p>
      <div class="rolagem"><table class="dados"><thead><tr><th>Plataforma</th><th class="num">Investimento</th><th class="num">Usado</th><th>Ritmo</th><th class="num">Projeção</th><th>Status</th></tr></thead>
      <tbody>${porPlat.map((g) => `<tr><td>${esc(g.rotulo)}</td><td class="num">${brl(g.total.investimento)}</td><td class="num">${brl(g.total.gasto)}</td><td>${regua(g.total)}</td><td class="num">${brl(g.total.projecaoFim)}</td><td>${chip(g.total.status)}</td></tr>`).join('')}</tbody></table></div>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- tabela de ritmo
const COLS = `<tr><th>Nome</th><th>Período</th><th class="num">Investimento</th><th class="num">Usado</th><th class="num">Saldo</th><th>Ritmo</th><th class="num">Índice</th><th class="num">Média 7d</th><th class="num">Diária necessária</th><th class="num">Projeção</th><th>Status</th></tr>`;

function linhaTabela(x, nome, { classe = '', nivel = 0, chave = '', expansivel = false, aberto = false, linhaId = null } = {}) {
  const periodo = x.inicio ? `${dataCurta(x.inicio)} a ${dataCurta(x.fim)}` : '';
  const exp = expansivel ? `<button class="expansor" data-expandir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${aberto ? 'Recolher' : 'Expandir'}">${aberto ? '▾' : '▸'}</button>` : '<span class="expansor"></span>';
  const clic = linhaId ? ` class="${classe} clicavel" data-detalhe="${esc(linhaId)}"` : ` class="${classe}"`;
  return `<tr${clic}><td class="nome recuo-${nivel}">${exp}${nome}</td><td>${periodo}</td><td class="num">${brl(x.investimento)}</td><td class="num">${brl(x.gasto)}</td><td class="num">${brl(x.saldo)}</td>
    <td>${regua(x)}</td><td class="num">${x.indice === null || x.indice === undefined ? '—' : decimal(x.indice)}</td><td class="num">${brl(x.media)}</td><td class="num">${x.diariaNecessaria ? brl(x.diariaNecessaria) : '—'}</td>
    <td class="num">${brl(x.projecaoFim)}</td><td>${chip(x.status)}</td></tr>`;
}

export function tabelaRitmo(ctx) {
  const { estado, nomes } = ctx;
  const agrup = estado.agrupamento;
  const nivel1 = agrup === 'flight' ? (m) => m.linha.flightId : (m) => m.linha.plataforma;
  const rot1 = agrup === 'flight' ? (m) => rotuloFlight(m.linha.aba) : (m) => m.linha.plataforma;
  const nivel2 = agrup === 'flight' ? (m) => m.linha.produto : (m) => m.linha.produto;
  const linhas = [];
  for (const g1 of agruparPor(ctx.metricas, nivel1, rot1)) {
    const k1 = `g1:${g1.chave}`;
    const a1 = !estado.recolhidos.has(k1);
    linhas.push(linhaTabela({ ...g1.total, media: g1.total.media }, `<span class="forte">${esc(g1.rotulo)}</span> <span class="mudo">${g1.itens.length} linha(s)</span>`, { classe: 'grupo-1', chave: k1, expansivel: true, aberto: a1 }));
    if (!a1) continue;
    for (const g2 of agruparPor(g1.itens, nivel2, nivel2)) {
      const k2 = `${k1}|g2:${g2.chave}`;
      const a2 = !estado.recolhidos.has(k2);
      linhas.push(linhaTabela(g2.total, `${esc(g2.rotulo)} <span class="mudo">${g2.itens.length}</span>`, { classe: 'grupo-2', nivel: 1, chave: k2, expansivel: true, aberto: a2 }));
      if (!a2) continue;
      for (const m of g2.itens) {
        const k3 = `l:${m.linhaId}`;
        const a3 = estado.expandidos.has(k3);
        const x = { ...m, inicio: m.linha.inicio, fim: m.linha.fim };
        const nome = `${esc(rotuloLinha(m.linha))}${m.entidades.length ? ` <span class="mudo">· ${m.entidades.length} conjunto(s)</span>` : ''}`;
        linhas.push(linhaTabela(x, nome, { nivel: 2, chave: k3, expansivel: m.entidades.length > 0, aberto: a3, linhaId: m.linhaId }));
        if (!a3) continue;
        for (const e of m.entidades) {
          const n = nomes.get(e.chave);
          linhas.push(`<tr class="conjunto"><td class="nome recuo-3"><span class="expansor"></span>${esc(n?.conjuntoNome || e.chave)} <span class="mudo">· ${esc(n?.campanhaNome || '')}</span></td><td>${e.dias} dia(s)</td><td class="num">—</td><td class="num">${brl(e.gasto)}</td><td></td><td></td><td></td><td></td>
            <td class="num" title="Orçamento diário configurado na plataforma (último dia)">${e.orcamentoDiario ? `config. ${brl(e.orcamentoDiario)}` : '—'}</td><td></td><td class="mudo">${m.gasto ? pct(e.gasto / m.gasto, 0) : ''} da linha</td></tr>`);
        }
      }
    }
  }
  const t = ctx.total;
  return `<section>
    <div class="cabeca-bloco" style="margin-bottom:12px">
      <div><label class="campo">Agrupar por
        <select data-acao-change="agrupar"><option value="plataforma" ${agrup !== 'flight' ? 'selected' : ''}>Plataforma › campanha › linha › conjunto</option><option value="flight" ${agrup === 'flight' ? 'selected' : ''}>Flight › campanha › linha › conjunto</option></select></label></div>
      <div class="acoes-topo"><button class="btn btn-mini" data-acao="expandir-tudo">Abrir conjuntos</button><button class="btn btn-mini" data-acao="recolher-tudo">Recolher</button><button class="btn btn-mini" data-acao="exportar-pacing">Exportar CSV</button></div>
    </div>
    <div class="rolagem"><table class="dados"><thead>${COLS}</thead><tbody>
      ${linhaTabela({ ...t }, `<span class="forte">Total filtrado</span>`, { classe: 'grupo-1' })}
      ${linhas.join('')}
    </tbody></table></div>
    <p class="dica">Clique em uma linha do plano para ver gráficos, conjuntos e alertas.</p>
  </section>`;
}

// ---------------------------------------------------------------- turmas
export function telaTurmas(ctx) {
  const grupos = agruparPor(ctx.metricas, (m) => ctx.turmas.get(m.linhaId)?.chave, (m) => ctx.turmas.get(m.linhaId)?.rotulo);
  grupos.sort((a, b) => (ctx.turmas.get(a.itens[0].linhaId)?.dataTurma || '9') .localeCompare(ctx.turmas.get(b.itens[0].linhaId)?.dataTurma || '9'));
  const linhas = grupos.map((g) => {
    const dt = ctx.turmas.get(g.itens[0].linhaId)?.dataTurma;
    const dias = dt ? diffDias(ctx.ref, dt) : null;
    const k = `t:${g.chave}`;
    const aberto = ctx.estado.expandidos.has(k);
    const linhaG = `<tr class="grupo-2"><td class="nome"><button class="expansor" data-expandir="${esc(k)}" aria-expanded="${aberto}">${aberto ? '▾' : '▸'}</button>${esc(g.rotulo)}</td>
      <td>${dt ? `${dataBR(dt)}${dias !== null ? ` <span class="mudo">(${dias >= 0 ? `em ${dias} dia(s)` : 'já começou'})</span>` : ''}` : '<span class="mudo">sem data</span>'}</td>
      <td class="num">${g.itens.length}</td><td class="num">${brl(g.total.investimento)}</td><td class="num">${brl(g.total.gasto)}</td><td>${regua(g.total)}</td><td class="num">${brl(g.total.projecaoFim)}</td>
      <td>${chip(g.total.status)}</td></tr>`;
    const filhas = aberto ? g.itens.map((m) => `<tr class="clicavel" data-detalhe="${esc(m.linhaId)}"><td class="nome recuo-1"><span class="expansor"></span>${esc(rotuloFlight(m.linha.aba))}</td><td>${dataCurta(m.linha.inicio)} a ${dataCurta(m.linha.fim)}</td><td></td>
      <td class="num">${brl(m.investimento)}</td><td class="num">${brl(m.gasto)}</td><td>${regua(m)}</td><td class="num">${brl(m.projecaoFim)}</td><td>${chip(m.status)}</td></tr>`).join('') : '';
    return linhaG + filhas;
  });
  return `<section>
    <p class="dica" style="margin-top:0">Cada turma soma a verba de todos os flights em que aparece (ex.: Set/1 + Set/2 + Out). Linhas do mesmo produto e praça que compartilham um código de turma ficam juntas.</p>
    <div class="rolagem"><table class="dados"><thead><tr><th>Turma</th><th>Início da turma</th><th class="num">Flights</th><th class="num">Investimento</th><th class="num">Usado</th><th>Ritmo</th><th class="num">Projeção</th><th>Status</th></tr></thead>
    <tbody>${linhas.join('')}</tbody></table></div></section>`;
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
