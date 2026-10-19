// Persistência local (navegador). v1 sem backend: cada analista guarda os clientes no
// próprio navegador e compartilha via "Exportar/Importar workspace" (JSON).
// Quando houver backend, troque só este módulo (mesma interface).

const CHAVE = 'ampla-monitor-pacing:v1';

const vazio = () => ({ versao: 1, clienteAtivo: null, clientes: {} });

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return vazio();
    const db = JSON.parse(bruto);
    return db && db.clientes ? db : vazio();
  } catch {
    return vazio();
  }
}

export function salvar(db) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
    return true;
  } catch (e) {
    console.warn('Não foi possível salvar no navegador', e);
    return false;
  }
}

/** Workspace de um cliente: plano(s), realizado, vínculos e tudo que o analista registra. */
export function novoWorkspace(plano) {
  return {
    clienteId: plano.clienteId,
    cliente: plano.cliente,
    planos: [plano],
    planoAtivo: plano.id,
    realizado: [],
    vinculos: {},
    decisoes: {},
    justificativas: {},
    notas: [],
    config: {},
    historico: [{ quando: new Date().toISOString(), o: `Plano importado: ${plano.arquivo || plano.id}` }],
  };
}

export function exportarJSON(db, clienteId) {
  const conteudo = clienteId ? { versao: 1, clienteAtivo: clienteId, clientes: { [clienteId]: db.clientes[clienteId] } } : db;
  return JSON.stringify(conteudo, null, 2);
}

export function importarJSON(db, texto) {
  const entrada = JSON.parse(texto);
  if (!entrada?.clientes) throw new Error('Arquivo não é um workspace do monitor (falta "clientes").');
  const ids = Object.keys(entrada.clientes);
  for (const id of ids) db.clientes[id] = entrada.clientes[id];
  db.clienteAtivo = ids[0] || db.clienteAtivo;
  return ids;
}
