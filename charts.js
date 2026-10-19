// Gráficos com Chart.js (global `Chart`, carregado via <script> UMD).
import { brl, dataCurta, inteiro } from '../core/format.js';

const instancias = new Map();
const cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function destruirGraficos(prefixo = '') {
  for (const [id, g] of instancias) if (id.startsWith(prefixo)) { g.destroy(); instancias.delete(id); }
}

function criar(canvas, config) {
  if (!canvas || typeof Chart === 'undefined') return;
  const id = canvas.id;
  if (instancias.has(id)) instancias.get(id).destroy();
  const Ch = globalThis.Chart;
  Ch.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Ch.defaults.color = cor('--tinta-2');
  instancias.set(id, new Ch(canvas, config));
}

const reaisCurtos = (c) => {
  const v = c / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

function base(s, eixoY) {
  const iRef = s.datas.indexOf(s.ref);
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 18, callback: (v, i) => dataCurta(s.datas[i]) } },
      y: { beginAtZero: true, grid: { color: cor('--linha') }, border: { display: false }, ticks: { callback: eixoY } },
    },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: false, filter: (i) => !i.text.startsWith('_') } },
      tooltip: {
        callbacks: {
          title: (it) => dataCurta(s.datas[it[0].dataIndex]),
          label: (it) => (it.dataset.label.startsWith('_') ? null : `${it.dataset.label}: ${it.dataset.formato === 'n' ? inteiro(it.raw) : brl(it.raw)}`),
        },
      },
      hojeMarcador: { indice: iRef },
    },
  };
}

// linha vertical em "hoje"
const pluginHoje = {
  id: 'hojeMarcador',
  afterDraw(chart, _a, opts) {
    const i = opts?.indice;
    if (i === undefined || i < 0) return;
    const x = chart.scales.x.getPixelForValue(i);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = cor('--tinta-3');
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cor('--tinta-2');
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('hoje', x + 4, top + 12);
    ctx.restore();
  },
};

export function graficoAcumulado(canvas, s) {
  if (!s) return;
  criar(canvas, {
    type: 'line',
    data: {
      labels: s.datas,
      datasets: [
        { label: '_faixaMax', data: s.faixaMax, borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: cor('--faixa') },
        { label: '_faixaMin', data: s.faixaMin, borderWidth: 0, pointRadius: 0, fill: false },
        { label: 'Planejado (ideal)', data: s.planejadoAcum, borderColor: cor('--tinta-3'), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0 },
        { label: 'Realizado', data: s.realizadoAcum, borderColor: cor('--marca'), backgroundColor: cor('--marca'), borderWidth: 2.5, pointRadius: 0, tension: 0.15, spanGaps: false },
        { label: 'Projeção (média 7 dias)', data: s.projecaoAcum, borderColor: cor('--over-1'), borderWidth: 2, borderDash: [2, 4], pointRadius: 0, spanGaps: true },
      ],
    },
    options: base(s, reaisCurtos),
    plugins: [pluginHoje],
  });
}

export function graficoDiario(canvas, s) {
  if (!s) return;
  criar(canvas, {
    data: {
      labels: s.datas,
      datasets: [
        { type: 'bar', label: 'Gasto do dia', data: s.gastoDiario, backgroundColor: cor('--under-1'), borderRadius: 2, maxBarThickness: 18, order: 2 },
        { type: 'line', label: 'Diária planejada', data: s.diariaPlan, borderColor: cor('--tinta-3'), borderWidth: 1.5, stepped: true, pointRadius: 0, order: 1 },
        { type: 'line', label: 'Diária necessária', data: s.diariaNecessaria, borderColor: cor('--ok'), borderWidth: 2, stepped: true, pointRadius: 0, spanGaps: false, order: 0 },
      ],
    },
    options: base(s, reaisCurtos),
    plugins: [pluginHoje],
  });
}

export function graficoResultado(canvas, s, rotulo = 'resultados') {
  if (!s) return;
  const o = base(s, (v) => inteiro(v));
  criar(canvas, {
    type: 'line',
    data: {
      labels: s.datas,
      datasets: [
        { label: `Planejado (${rotulo})`, data: s.resultadoPlanAcum, borderColor: cor('--tinta-3'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, formato: 'n' },
        { label: `Realizado (${rotulo})`, data: s.resultadoAcum, borderColor: cor('--ok'), borderWidth: 2.5, pointRadius: 0, formato: 'n' },
      ],
    },
    options: o,
    plugins: [pluginHoje],
  });
}
