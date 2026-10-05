// Gráficos Chart.js lendo as cores dos tokens CSS (claro/escuro).
const ativos = new Set();

export function cores() {
  const css = getComputedStyle(document.documentElement);
  const v = n => css.getPropertyValue(n).trim();
  return { s1: v('--s1'), s2: v('--s2'), s3: v('--s3'), s4: v('--s4'), tinta: v('--tinta'), tinta2: v('--tinta-2'), tinta3: v('--tinta-3'), linha: v('--linha'), superficie: v('--superficie') };
}

export function destruirGraficos() {
  for (const g of ativos) g.destroy();
  ativos.clear();
}

export function graficoBarras(canvas, { rotulos, series, horizontal = false, formatar, formatarEixo = formatar }) {
  if (!window.Chart) return null;
  const c = cores();
  const g = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: series.map(s => ({
        label: s.nome, data: s.valores, backgroundColor: s.cor, borderRadius: 4, borderSkipped: false,
        borderColor: c.superficie, borderWidth: 1, maxBarThickness: 36, categoryPercentage: .8, barPercentage: .9,
      })),
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: series.length > 1, position: 'top', align: 'start', labels: { color: c.tinta2, boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3, font: { family: 'Manrope', weight: 600 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatar(ctx.parsed[horizontal ? 'x' : 'y'])}` } },
      },
      scales: {
        x: { grid: { display: horizontal, color: c.linha }, border: { color: c.linha }, ticks: { color: c.tinta3, font: { family: 'Manrope' }, maxRotation: 0, autoSkipPadding: 8, ...(horizontal && { callback: v => formatarEixo(v) }) } },
        y: { grid: { display: !horizontal, color: c.linha }, border: { display: false }, ticks: { color: c.tinta3, font: { family: 'Manrope' }, ...(!horizontal && { callback: v => formatarEixo(v) }) }, beginAtZero: true },
      },
    },
  });
  ativos.add(g);
  return g;
}
