// Utilitários puros (sem DOM) de dinheiro, números e datas.
// Dinheiro é SEMPRE guardado em centavos inteiros para não acumular erro de ponto flutuante.
// Datas são SEMPRE strings ISO 'AAAA-MM-DD' (dia civil em America/Sao_Paulo, sem hora).

/** Converte número ou texto ("R$ 1.234,56", "1234.56", "207,8878") em número. null se vazio/inválido. */
export function parseNumero(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === '-' || s === '—') return null;
  s = s.replace(/R\$|\s|%/g, '');
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // o último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  } else if (temPonto && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, ''); // 1.234.567 → milhar
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Valor monetário → centavos inteiros (arredonda). */
export function paraCentavos(v) {
  const n = parseNumero(v);
  return n === null ? null : Math.round(n * 100);
}

/** Percentual: aceita 0,1215 | 12,15% | "12,15%" → fração (0.1215). */
export function parsePercentual(v) {
  if (v === null || v === undefined || v === '') return null;
  const texto = typeof v === 'string';
  const n = parseNumero(v);
  if (n === null) return null;
  if (texto && String(v).includes('%')) return n / 100;
  return n > 1 ? n / 100 : n;
}

const pad = (n) => String(n).padStart(2, '0');

/** Date/serial Excel/"dd/mm/aaaa"/"aaaa-mm-dd" → 'AAAA-MM-DD' (ou null). */
export function parseData(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS (cellDates) entrega meia-noite local; usamos os componentes locais.
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400000); // serial Excel → epoch
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${ano}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}

const toUTC = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const fromUTC = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDias = (iso, n) => fromUTC(toUTC(iso) + n * 86400000);
/** Diferença em dias (b − a). */
export const diffDias = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
/** Dias entre a e b contando os dois extremos (contagem do plano: 02/09→22/09 = 21). */
export const diasInclusivos = (a, b) => (b < a ? 0 : diffDias(a, b) + 1);
export const minData = (a, b) => (a < b ? a : b);
export const maxData = (a, b) => (a > b ? a : b);
export const fimDoMes = (iso) => {
  const [a, m] = iso.split('-').map(Number);
  return fromUTC(Date.UTC(a, m, 0));
};
export const inicioDoMes = (iso) => iso.slice(0, 8) + '01';

/** Lista de datas ISO de a até b (inclusivo). */
export function intervalo(a, b) {
  const out = [];
  for (let d = a; d <= b; d = addDias(d, 1)) out.push(d);
  return out;
}

/** "Hoje" no fuso America/Sao_Paulo como ISO. */
export function hojeSP(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
  return partes; // en-CA já formata AAAA-MM-DD
}

// ---------- apresentação (pt-BR) ----------
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const brl = (centavos) => (centavos === null || centavos === undefined ? '—' : fmtBRL.format(centavos / 100));
export const inteiro = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : fmtInt.format(n));
export const decimal = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : fmtDec.format(n));
export const pct = (f, casas = 1) =>
  f === null || f === undefined || !Number.isFinite(f)
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(f);
export const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
export const dataCurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

/** Normaliza texto para comparação: sem acento, maiúsculo, espaços simples. */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai códigos de turma (EV-12345) de um texto livre. */
export function extrairCodigosTurma(texto) {
  const achados = String(texto ?? '').toUpperCase().match(/EV\s*-?\s*\d{4,7}/g) || [];
  return [...new Set(achados.map((c) => 'EV-' + c.replace(/\D/g, '')))];
}
