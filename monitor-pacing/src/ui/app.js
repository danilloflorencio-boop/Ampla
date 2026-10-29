// Monitor de pacing · controlador da interface.
// Sem framework: estado em memória → cálculo derivado → HTML → eventos por delegação.
import { hojeSP, addDias, dataCurta, brl, normalizar } from '../core/format.js';
import { lerPlano, diffPlanos, rotuloLinha } from '../core/plano.js';
import { lerCSV, normalizarRealizado, mesclarRealizado, entidadesDoRealizado, ultimaExtracao, paraCSV, chaveEntidade } from '../core/realizado.js';
import { sugerirVinculos, aplicarSugestoes, alocarRealizado } from '../core/vinculo.js';
import { calcularTudo, agregar, indexarAlocacoes, series, chavesDeTurma } from '../core/pacing.js';
import { avaliarRegras, aplicarDecisoes } from '../core/regras.js';
import { gerarRealizadoMock } from '../core/mock.js';
import { montarPainel, filtrarPainel, soPacing } from '../core/painel.js';
import { montarAvisos } from '../core/avisos.js';
import { configDoCliente } from '../config/config.js';
import * as armazenamento from './storage.js';
import * as V from './views.js';
import { graficoAcumulado, graficoDiario, destruirGraficos } from './charts.js';
import { montarDemo, EQUIPE_DEMO, REF_DEMO } from '../demo/demoPainel.js';

const ABAS_GERAIS = ['painel', 'equipe'];
const FILTRO_PAINEL_VAZIO = { analista: '', lideranca: '', cliente: '', plataforma: '', situacao: '' };

const db0 = armazenamento.carregar();
const estado = {
  db: db0,
  ref: hojeSP(),
  aba: 'painel',
  // "Contas de" fica guardado: cada analista abre o painel já na própria carteira.
  filtroPainel: { ...FILTRO_PAINEL_VAZIO, ...(db0.preferencias.filtroPainel || {}) },
  filtros: { plataforma: '', flight: '', produto: '', praca: '', situacao: '' },
  filtroAlertas: { estado: 'aberto', severidade: '', regra: '' },
  agrupamento: 'plataforma',
  expandidos: new Set(),
  recolhidos: new Set(),
  detalhe: null,
  pendente: null,
  filtrosAbertos: false,
};

const $ = (s, el = document) => el.querySelector(s);
const ws = () => estado.db.clientes[estado.db.clienteAtivo] || null;
const planoAtivo = (w) => w?.planos.find((p) => p.id === w.planoAtivo) || w?.planos[0] || null;
const persistir = () => { if (!armazenamento.salvar(estado.db)) toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).'); };

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function baixar(nome, conteudo, tipo = 'text/plain') {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado.'); }
  catch {
    const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiado.'); } catch { toast('Não foi possível copiar.'); }
    ta.remove();
  }
}

// ------------------------------------------------------------------ cálculo derivado
function calcular() {
  const w = ws();
  const plano = planoAtivo(w);
  if (!w || !plano) return null;
  const cfg = configDoCliente(w.config);
  const ref = estado.ref;
  const registros = w.realizado;
  const entidades = entidadesDoRealizado(registros);
  const nomes = new Map(entidades.map((e) => [e.chave, e]));
  const sugestoes = sugerirVinculos(entidades, plano.linhas, w.vinculos);
  const alloc = alocarRealizado(registros, plano.linhas, w.vinculos, ref);
  const { metricas: metricasTodas } = calcularTudo(plano.linhas, alloc.alocacoes, ref, cfg);
  const f = estado.filtros;
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
    db: estado.db, ws: w, plano, cfg, ref, filtros: f, opcoes, estado, entidades, nomes, sugestoes, alloc,
    metricasTodas, metricas, total, alertas, alertasFiltrados, ultimaExtracao: ext, pendenciasVinculo,
    turmas: chavesDeTurma(plano.linhas),
  };
}

/** Painel com todas as contas de todos os clientes deste navegador, e os avisos do dia. */
function calcularPainel() {
  const cfg = configDoCliente({ avisos: { linkPainel: estado.db.preferencias.linkPainel || '' } });
  const painel = montarPainel(Object.values(estado.db.clientes), estado.ref);
  return {
    ...painel, cfg,
    filtradas: filtrarPainel(painel.contas, estado.filtroPainel, estado.db.equipe),
    avisos: montarAvisos(painel.contas, estado.db.equipe, estado.ref, cfg),
  };
}

// ------------------------------------------------------------------ render
let ctxAtual = null;
let painelAtual = null;
function render() {
  const app = $('#app');
  destruirGraficos();
  if (!estado.db.clientes[estado.db.clienteAtivo]) estado.db.clienteAtivo = Object.keys(estado.db.clientes)[0] || null;
  ctxAtual = calcular();
  if (!ctxAtual) {
    app.innerHTML = `<header class="topo"><div class="topo-linha"><div class="marca-app"><h1>Monitor de pacing</h1><span>Ampla · mídia</span></div></div></header><main>${V.telaVazia()}</main>`;
    return;
  }
  painelAtual = calcularPainel();
  const c = ctxAtual;
  const telas = {
    painel: () => V.telaPainel(painelAtual, estado, estado.db), equipe: () => V.telaEquipe(painelAtual, estado.db),
    geral: V.visaoGeral, ritmo: V.tabelaRitmo, turmas: V.telaTurmas, alertas: V.telaAlertas, vinculos: V.telaVinculos, plano: V.telaPlano,
  };
  app.innerHTML = `${V.topo(c, painelAtual)}<main id="principal" class="${ABAS_GERAIS.includes(estado.aba) ? 'principal-geral' : ''}">${(telas[estado.aba] || V.visaoGeral)(c)}</main><div id="painel">${estado.detalhe ? V.painelLinha(c, estado.detalhe) : ''}</div>`;
  requestAnimationFrame(desenharGraficos);
}

/** Abre um cliente (e, se vier, uma plataforma) a partir do painel ou do link do aviso. */
function abrirCliente(clienteId, plataforma = '') {
  if (!estado.db.clientes[clienteId]) { toast('Essa conta não está carregada neste navegador.'); return false; }
  estado.db.clienteAtivo = clienteId;
  estado.filtros = { plataforma, flight: '', produto: '', praca: '', situacao: '' };
  estado.aba = 'geral';
  estado.detalhe = null;
  persistir();
  render();
  window.scrollTo({ top: 0 });
  return true;
}

const salvarFiltroPainel = () => { estado.db.preferencias.filtroPainel = { analista: estado.filtroPainel.analista, lideranca: estado.filtroPainel.lideranca }; persistir(); };

function desenharGraficos() {
  const c = ctxAtual;
  if (!c) return;
  if (estado.aba === 'geral' && c.metricas.length) {
    const s = series(c.metricas, c.ref, c.cfg);
    graficoAcumulado($('#g-geral-acum'), s);
    graficoDiario($('#g-geral-dia'), s);
  }
  if (estado.detalhe) {
    const m = c.metricasTodas.find((x) => x.linhaId === estado.detalhe);
    if (m) {
      const s = series([m], c.ref, c.cfg);
      graficoAcumulado($('#g-painel-acum'), s);
      graficoDiario($('#g-painel-dia'), s);
    }
  }
}

function abrirDialogo(html) {
  const d = $('#dlg');
  d.innerHTML = html;
  if (!d.open) d.showModal();
}
const fecharDialogo = () => { const d = $('#dlg'); if (d.open) d.close(); estado.pendente = null; };

// ------------------------------------------------------------------ importações
function lerPlanilha(buffer) {
  const X = globalThis.XLSX;
  if (!X) throw new Error('Leitor de planilhas (SheetJS) não carregou. Verifique a conexão.');
  const wb = X.read(buffer, { type: 'array', cellDates: true });
  return wb.SheetNames.map((nome) => ({ nome, linhas: X.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true }) }));
}

async function aoEscolherPlano(arquivo) {
  try {
    const abas = lerPlanilha(await arquivo.arrayBuffer());
    const plano = lerPlano(abas, { arquivo: arquivo.name });
    if (!plano.linhas.length) { toast('Nenhuma aba no formato do plano Ampla (tabela PLANO DE MÍDIA com “Investimento Plataforma R$”).'); return; }
    const existente = estado.db.clientes[plano.clienteId];
    if (existente) {
      estado.pendente = { tipo: 'plano', plano };
      abrirDialogo(V.dialogoDiff(diffPlanos(planoAtivo(existente), plano), arquivo.name));
    } else {
      estado.db.clientes[plano.clienteId] = armazenamento.novoWorkspace(plano);
      estado.db.clienteAtivo = plano.clienteId;
      persistir();
      estado.aba = 'plano';
      render();
      toast(`Plano importado: ${plano.linhas.length} linhas em ${plano.flights.length} flight(s).`);
    }
  } catch (e) { console.error(e); toast(`Erro ao ler o plano: ${e.message}`); }
}

function confirmarPlano() {
  const { plano } = estado.pendente || {};
  const w = plano && estado.db.clientes[plano.clienteId];
  if (!w) return fecharDialogo();
  // remapeia vínculos/decisões/justificativas de linhas que continuam (chave estável)
  const chave = (l) => `${l.aba}|${l.produto}|${normalizar(l.codigoRaw)}|${l.praca}`;
  const novoPorChave = new Map(plano.linhas.map((l) => [chave(l), l.id]));
  const mapa = new Map(planoAtivo(w).linhas.map((l) => [l.id, novoPorChave.get(chave(l))]));
  for (const v of Object.values(w.vinculos)) v.linhas = v.linhas.map((id) => mapa.get(id)).filter(Boolean);
  w.justificativas = Object.fromEntries(Object.entries(w.justificativas).map(([id, t]) => [mapa.get(id), t]).filter(([id]) => id));
  for (const n of w.notas) n.linhaId = mapa.get(n.linhaId) || n.linhaId;
  w.planos = [plano, ...w.planos.filter((p) => p.id !== plano.id)].slice(0, 5);
  w.planoAtivo = plano.id;
  w.historico.push({ quando: new Date().toISOString(), o: `Nova versão do plano: ${plano.arquivo}` });
  estado.db.clienteAtivo = plano.clienteId;
  persistir();
  fecharDialogo();
  render();
  toast('Plano substituído. Vínculos das linhas que continuam foram mantidos.');
}

async function aoEscolherRealizado(arquivo) {
  try {
    let matriz;
    if (/\.(xlsx|xls)$/i.test(arquivo.name)) matriz = lerPlanilha(await arquivo.arrayBuffer())[0]?.linhas || [];
    else matriz = lerCSV(await arquivo.text());
    const cab = (matriz[0] || []).map((h) => normalizar(h));
    const semPlataforma = !cab.some((h) => ['PLATAFORMA', 'PLATFORM', 'SOURCE', 'DATASOURCE', 'FONTE', 'CANAL'].includes(h));
    const res = normalizarRealizado(matriz, { plataformaPadrao: 'META ADS', dataExtracaoPadrao: new Date().toISOString().slice(0, 16) });
    const datas = res.registros.map((r) => r.data).sort();
    estado.pendente = { tipo: 'realizado', matriz, semPlataforma, arquivo: arquivo.name };
    abrirDialogo(V.dialogoRealizado({ ...res, arquivo: arquivo.name, semPlataforma, periodo: datas.length ? `${dataCurta(datas[0])} a ${dataCurta(datas.at(-1))}` : '' }));
  } catch (e) { console.error(e); toast(`Erro ao ler o arquivo: ${e.message}`); }
}

function confirmarRealizado() {
  const p = estado.pendente;
  const w = ws();
  if (!p || !w) return fecharDialogo();
  const plat = $('#dlg select[name="plataforma-padrao"]')?.value || 'META ADS';
  const { registros } = normalizarRealizado(p.matriz, { plataformaPadrao: plat, dataExtracaoPadrao: new Date().toISOString().slice(0, 16) });
  const m = mesclarRealizado(w.realizado, registros);
  w.realizado = m.registros;
  w.historico.push({ quando: new Date().toISOString(), o: `Realizado: ${p.arquivo} (${m.inseridos} novos, ${m.atualizados} atualizados)` });
  persistir();
  fecharDialogo();
  render();
  toast(`${m.inseridos} registro(s) novo(s), ${m.atualizados} atualizado(s).`);
}

function abrirDemo() {
  estado.ref = REF_DEMO;
  for (const { plano, realizado, analista } of montarDemo(REF_DEMO)) {
    plano.importadoEm = new Date().toISOString();
    const w = armazenamento.novoWorkspace(plano);
    w.realizado = realizado;
    w.analista = analista;
    const sug = sugerirVinculos(entidadesDoRealizado(w.realizado), plano.linhas, {});
    w.vinculos = aplicarSugestoes({}, sug, 'alta').vinculos;
    estado.db.clientes[plano.clienteId] = w;
    estado.db.clienteAtivo = estado.db.clienteAtivo || plano.clienteId;
  }
  const emails = new Set(estado.db.equipe.pessoas.map((x) => x.email));
  estado.db.equipe.pessoas.push(...EQUIPE_DEMO.pessoas.filter((x) => !emails.has(x.email)).map((x) => ({ ...x })));
  persistir();
  estado.aba = 'painel';
  render();
  toast(`Demonstração aberta com 4 clientes e data de referência ${dataCurta(REF_DEMO)}/2026. Os clientes “Demo” e a equipe são fictícios.`);
}

function gerarMock() {
  const w = ws(); const plano = planoAtivo(w);
  if (!w) return;
  if (w.realizado.length && !confirm('Substituir o realizado atual por dados de demonstração?')) return;
  w.realizado = gerarRealizadoMock(plano, estado.ref);
  const sug = sugerirVinculos(entidadesDoRealizado(w.realizado), plano.linhas, {});
  w.vinculos = aplicarSugestoes({}, sug, 'alta').vinculos;
  persistir(); render();
  toast('Dados de demonstração gerados até ontem.');
}

function exportarPacing() {
  const c = ctxAtual; if (!c) return;
  const cab = ['flight', 'plataforma', 'produto', 'praca', 'codigo', 'inicio', 'fim', 'situacao', 'status', 'investimento_plataforma', 'usado', 'saldo', 'planejado_ate_ontem', 'indice', 'media_7d', 'diaria_necessaria', 'projecao_fim', 'justificativa'];
  const r = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`);
  const c2 = (v) => (v === null || v === undefined ? '' : (v / 100).toFixed(2));
  const linhas = c.metricas.map((m) => [m.linha.aba, m.linha.plataforma, m.linha.produto, m.linha.praca, m.linha.codigoRaw.replace(/\s+/g, ' '), m.linha.inicio, m.linha.fim, m.situacao, m.status.rotulo,
    c2(m.investimento), c2(m.gasto), c2(m.saldo), c2(m.planejadoAteOntem), m.indice === null ? '' : m.indice.toFixed(3), c2(m.media), c2(m.diariaNecessaria), c2(m.projecaoFim),
    c.ws.justificativas[m.linhaId] || ''].map(r).join(','));
  baixar(`pacing_${c.ws.clienteId}_${c.ref}.csv`, [cab.join(','), ...linhas].join('\n'), 'text/csv');
}

function textoAcoesAbertas() {
  const c = ctxAtual;
  const abertos = c.alertasFiltrados.filter((a) => a.estado === 'aberto' && a.severidade !== 'info');
  const cab = `Review de pacing · ${c.ws.cliente} · ${dataCurta(c.ref)} (dados até ${dataCurta(addDias(c.ref, -1))})`;
  return [cab, '', ...abertos.map((a, i) => `${i + 1}. [${a.severidade === 'critico' ? 'CRÍTICO' : 'Atenção'}] ${a.titulo}\n   ${a.mensagem}\n   Ação: ${a.acao}${a.complemento ? `\n   Obs.: ${a.complemento}` : ''}`)].join('\n');
}

// ------------------------------------------------------------------ eventos
function acao(nome, el) {
  const w = ws();
  switch (nome) {
    case 'importar-plano': return $('#in-plano').click();
    case 'importar-realizado': return w ? $('#in-real').click() : toast('Importe um plano primeiro.');
    case 'importar-workspace': return $('#in-ws').click();
    case 'abrir-demo': return abrirDemo();
    case 'gerar-mock': return gerarMock();
    case 'confirmar-plano': return confirmarPlano();
    case 'confirmar-realizado': return confirmarRealizado();
    case 'alternar-filtros': estado.filtrosAbertos = !estado.filtrosAbertos; return render();
    case 'limpar-filtros': estado.filtros = { plataforma: '', flight: '', produto: '', praca: '', situacao: '' }; return render();
    case 'expandir-tudo': ctxAtual.metricas.forEach((m) => estado.expandidos.add(`l:${m.linhaId}`)); estado.recolhidos.clear(); return render();
    case 'recolher-tudo': estado.expandidos.clear(); return render();
    case 'exportar-pacing': return exportarPacing();
    case 'copiar-acoes': return copiar(textoAcoesAbertas());
    case 'aceitar-altas': {
      const r = aplicarSugestoes(w.vinculos, ctxAtual.sugestoes, 'alta');
      w.vinculos = r.vinculos; persistir(); render(); return toast(`${r.aplicadas} vínculo(s) aceito(s).`);
    }
    case 'exportar-realizado': return baixar(`realizado_${w.clienteId}.csv`, paraCSV(w.realizado), 'text/csv');
    case 'limpar-realizado': if (confirm('Apagar todo o realizado deste cliente? Vínculos e decisões ficam.')) { w.realizado = []; persistir(); render(); } return;
    case 'exportar-workspace': return baixar(`workspace_${w.clienteId}_${estado.ref}.json`, armazenamento.exportarJSON(estado.db, w.clienteId), 'application/json');
    case 'limpar-filtros-painel': estado.filtroPainel = { ...FILTRO_PAINEL_VAZIO }; salvarFiltroPainel(); return render();
    case 'adicionar-pessoa': estado.db.equipe.pessoas.push({ nome: '', email: '', lider: null }); persistir(); return render();
    case 'exportar-avisos': {
      const { avisos } = painelAtual.avisos;
      return baixar(`avisos_pacing_${estado.ref}.json`, JSON.stringify({ ref: estado.ref, geradoEm: new Date().toISOString(), avisos: avisos.map(({ para, nome, papel, texto }) => ({ para, nome, papel, texto })) }, null, 2), 'application/json');
    }
    case 'exportar-tudo': return baixar(`workspace_ampla_${estado.ref}.json`, armazenamento.exportarJSON(estado.db), 'application/json');
    case 'remover-cliente':
      if (confirm(`Remover ${w.cliente} deste navegador? Exporte o workspace antes se quiser guardar.`)) {
        delete estado.db.clientes[w.clienteId];
        estado.db.clienteAtivo = Object.keys(estado.db.clientes)[0] || null;
        persistir(); render();
      }
      return;
    default: return null;
  }
}

function decidir(id, tipo) {
  const w = ws();
  if (tipo === 'reabrir') delete w.decisoes[id];
  else if (tipo === 'descartada') {
    const motivo = prompt('Motivo do descarte (fica registrado):');
    if (motivo === null) return;
    w.decisoes[id] = { estado: 'descartada', motivo, em: new Date().toISOString() };
  } else if (tipo === 'adiada') w.decisoes[id] = { estado: 'adiada', ate: addDias(estado.ref, 1), em: new Date().toISOString() };
  else w.decisoes[id] = { estado: tipo, em: new Date().toISOString() };
  persistir(); render();
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  const exp = t.closest('[data-expandir]');
  if (exp) {
    const k = exp.dataset.expandir;
    const conj = k.startsWith('g1:') ? estado.recolhidos : estado.expandidos;
    const inverte = k.startsWith('g1:');
    if (inverte) { conj.has(k) ? conj.delete(k) : conj.add(k); }
    else if (k.includes('|g2:')) { estado.recolhidos.has(k) ? estado.recolhidos.delete(k) : estado.recolhidos.add(k); }
    else { conj.has(k) ? conj.delete(k) : conj.add(k); }
    return render();
  }
  const abrir = t.closest('[data-abrir-cliente]');
  if (abrir) return abrirCliente(abrir.dataset.abrirCliente, abrir.dataset.plataforma || '');
  const el = t.closest('[data-copiar-aviso],[data-remover-pessoa],[data-aba],[data-acao],[data-detalhe],[data-fechar-painel],[data-decidir],[data-copiar],[data-aceitar-sugestao],[data-editar-vinculo],[data-desvincular],[data-salvar-vinculo],[data-fechar-dialogo],[data-salvar-justificativa],[data-salvar-nota]');
  if (!el) return;
  const d = el.dataset;
  const w = ws();
  if (d.copiarAviso !== undefined) { const a = painelAtual?.avisos.avisos[Number(d.copiarAviso)]; return a && copiar(a.texto); }
  if (d.removerPessoa !== undefined) {
    const [p] = estado.db.equipe.pessoas.splice(Number(d.removerPessoa), 1);
    if (p?.email) trocarEmail(p.email, null);
    persistir(); return render();
  }
  if (d.aba) { estado.aba = d.aba; estado.detalhe = null; render(); window.scrollTo({ top: 0 }); return; }
  if (d.acao) return acao(d.acao, el);
  if (d.detalhe) { estado.detalhe = d.detalhe; return render(); }
  if (el.hasAttribute('data-fechar-painel')) { estado.detalhe = null; return render(); }
  if (d.decidir) return decidir(d.id, d.decidir);
  if (d.copiar) { const a = ctxAtual.alertas.find((x) => x.id === d.copiar); return a && copiar(`${a.titulo}\n${a.mensagem}\nAção: ${a.acao}${a.complemento ? `\nObs.: ${a.complemento}` : ''}`); }
  if (d.aceitarSugestao) {
    const s = ctxAtual.sugestoes.find((x) => x.chave === d.aceitarSugestao);
    if (s) { w.vinculos[s.chave] = { linhas: s.linhas, origem: 'sugestao', confianca: s.confianca, confirmadoEm: new Date().toISOString() }; persistir(); render(); }
    return;
  }
  if (d.editarVinculo) return abrirDialogo(V.dialogoVinculo(ctxAtual, d.editarVinculo));
  if (d.desvincular) { delete w.vinculos[d.desvincular]; persistir(); return render(); }
  if (d.salvarVinculo) {
    const dlg = $('#dlg');
    const linhas = [...dlg.querySelectorAll('input[name="linha"]:checked')].map((i) => i.value);
    const pesos = {};
    for (const id of linhas) { const v = dlg.querySelector(`input[name="peso:${CSS.escape(id)}"]`)?.value; if (v) pesos[id] = Number(v); }
    if (linhas.length) w.vinculos[d.salvarVinculo] = { linhas, pesos: Object.keys(pesos).length ? pesos : undefined, origem: 'manual', confirmadoEm: new Date().toISOString() };
    else delete w.vinculos[d.salvarVinculo];
    persistir(); fecharDialogo(); return render();
  }
  if (el.hasAttribute('data-fechar-dialogo')) { ev.preventDefault(); return fecharDialogo(); }
  if (d.salvarJustificativa) {
    const v = $(`textarea[data-justificativa="${CSS.escape(d.salvarJustificativa)}"]`).value.trim();
    if (v) w.justificativas[d.salvarJustificativa] = v; else delete w.justificativas[d.salvarJustificativa];
    persistir(); render(); return toast('Justificativa salva.');
  }
  if (d.salvarNota) {
    const v = $(`textarea[data-nota="${CSS.escape(d.salvarNota)}"]`).value.trim();
    if (!v) return;
    w.notas.push({ linhaId: d.salvarNota, texto: v, quando: new Date().toISOString() });
    persistir(); render(); return toast('Nota adicionada.');
  }
});

/** Troca (ou apaga, com null) um e-mail da equipe em todas as referências: liderança e clientes. */
function trocarEmail(antigo, novo) {
  for (const p of estado.db.equipe.pessoas) if (p.lider === antigo) p.lider = novo;
  for (const w of Object.values(estado.db.clientes)) if (w.analista === antigo) w.analista = novo;
  for (const k of ['analista', 'lideranca']) if (estado.filtroPainel[k] === antigo) estado.filtroPainel[k] = novo || '';
}

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.filtroPainel !== undefined) { estado.filtroPainel[el.dataset.filtroPainel] = el.value; salvarFiltroPainel(); return render(); }
  if (el.dataset.analistaCliente !== undefined) {
    const w = estado.db.clientes[el.dataset.analistaCliente];
    if (w) { w.analista = el.value || null; persistir(); render(); }
    return;
  }
  if (el.dataset.pessoa !== undefined) {
    const p = estado.db.equipe.pessoas[Number(el.dataset.pessoa)];
    if (!p) return;
    const campo = el.dataset.campo;
    if (campo === 'email') {
      const novo = el.value.trim().toLowerCase();
      if (novo && estado.db.equipe.pessoas.some((x) => x !== p && x.email === novo)) { toast('Esse e-mail já está na equipe.'); return render(); }
      if (p.email) trocarEmail(p.email, novo || null);
      p.email = novo;
    } else if (campo === 'lider') p.lider = el.value && el.value !== p.email ? el.value : null;
    else p.nome = el.value.trim();
    persistir(); return render();
  }
  if (el.dataset.filtro !== undefined) { estado.filtros[el.dataset.filtro] = el.value; return render(); }
  if (el.dataset.filtroAlerta !== undefined) { estado.filtroAlertas[el.dataset.filtroAlerta] = el.value; return render(); }
  switch (el.dataset.acaoChange) {
    case 'trocar-cliente':
      estado.db.clienteAtivo = el.value; estado.detalhe = null;
      if (ABAS_GERAIS.includes(estado.aba)) estado.aba = 'geral';
      persistir(); return render();
    case 'link-painel': estado.db.preferencias.linkPainel = el.value.trim(); persistir(); return render();
    case 'trocar-ref': if (el.value) { estado.ref = el.value; render(); } return;
    case 'agrupar': estado.agrupamento = el.value; return render();
    default:
  }
  if (el.id === 'in-plano' && el.files[0]) { aoEscolherPlano(el.files[0]); el.value = ''; }
  if (el.id === 'in-real' && el.files[0]) { aoEscolherRealizado(el.files[0]); el.value = ''; }
  if (el.id === 'in-ws' && el.files[0]) {
    el.files[0].text().then((txt) => {
      try { const ids = armazenamento.importarJSON(estado.db, txt); persistir(); render(); toast(`Workspace importado: ${ids.length} cliente(s).`); }
      catch (e) { toast(`Erro: ${e.message}`); }
    });
    el.value = '';
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.hasAttribute('data-filtrar-lista')) {
    const q = el.value.trim().toLowerCase();
    for (const lab of document.querySelectorAll('#dlg .lista-check label')) lab.hidden = q && !lab.dataset.texto.includes(q);
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && estado.detalhe) { estado.detalhe = null; render(); }
  const linha = ev.target.closest?.('tr[data-abrir-cliente]');
  if (linha && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirCliente(linha.dataset.abrirCliente, linha.dataset.plataforma || ''); }
});

render();

// Link do aviso no chat: #cliente=…&plataforma=… abre direto a conta.
const doLink = new URLSearchParams(location.hash.slice(1));
if (doLink.get('cliente')) abrirCliente(doLink.get('cliente'), doLink.get('plataforma') || '');

// exposto para depuração no console
globalThis.monitorPacing = { estado, calcular, chaveEntidade, rotuloLinha, brl };
