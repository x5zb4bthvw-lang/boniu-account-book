/* ============================================
   波妞记账 — 图表模块 (依赖 Chart.js)
   ============================================ */

class ChartRenderer {
  constructor() {
    this.charts = {};
  }

  // ---- 月度收支柱状图 ----
  renderMonthlyBar(canvasId, monthlyData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = monthlyData.map(m => m.month + '月');
    const income = monthlyData.map(m => m.income);
    const expense = monthlyData.map(m => m.expense);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '收入', data: income, backgroundColor: 'rgba(52,199,89,0.6)', borderRadius: 4 },
          { label: '支出', data: expense, backgroundColor: 'rgba(255,59,48,0.6)', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '¥' + (v/1000).toFixed(0) + 'k' } } },
      },
    });
  }

  // ---- 分类饼图 ----
  renderPie(canvasId, data, colorPalette) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!data || data.length === 0) {
      // 清空 canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const labels = data.map(d => d.name);
    const values = data.map(d => d.amount);
    const colors = colorPalette || this._pinkPalette(data.length);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // ---- 资产趋势折线图 ----
  renderTrendLine(canvasId, trendData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = trendData.map(d => d.month + '月');
    const assets = trendData.map(d => d.assets);
    const liabilities = trendData.map(d => d.liabilities);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '资产', data: assets, borderColor: '#FF6B8A', backgroundColor: 'rgba(255,107,138,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
          { label: '负债', data: liabilities, borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.05)', fill: true, tension: 0.3, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false, ticks: { callback: v => '¥' + (v/10000).toFixed(0) + 'w' } } },
      },
    });
  }

  _pinkPalette(count) {
    const base = [
      '#FF6B8A', '#FF8FA3', '#FFB3C6', '#E55A75',
      '#FF7B95', '#FF9EB5', '#FFC4D4', '#FFD4E0',
      '#FF6B8A99', '#E55A7599', '#FF8FA399', '#FFB3C699',
    ];
    return base.slice(0, Math.max(count, 1));
  }

  _destroy(canvasId) {
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
      delete this.charts[canvasId];
    }
  }

  destroyAll() {
    Object.keys(this.charts).forEach(id => this._destroy(id));
  }
}

const chartRenderer = new ChartRenderer();
