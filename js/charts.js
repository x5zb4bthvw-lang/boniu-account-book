/* ============================================
   波妞记账 — 图表模块 (Chart.js)
   ============================================ */

class ChartRenderer {
  constructor() { this.charts = {}; }

  renderMainBar(canvasId, labels, data, type) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const color = type === 'income' ? 'rgba(46,125,50,0.7)' : 'rgba(255,87,34,0.7)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: color,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: v => '¥'+v } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  renderPie(canvasId, data, colors) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!data || !data.length) return;
    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.name),
        datasets: [{ data: data.map(d => d.amount), backgroundColor: colors || this._palette(data.length), borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: { legend: { display: false } },
      },
    });
  }

  renderMonthlyBar(canvasId, monthlyData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = monthlyData.map(m => m.month + '月');
    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '收入', data: monthlyData.map(m => m.income), backgroundColor: 'rgba(46,125,50,0.6)', borderRadius: 4 },
          { label: '支出', data: monthlyData.map(m => m.expense), backgroundColor: 'rgba(255,87,34,0.6)', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } },
      },
    });
  }

  _palette(n) {
    const b = ['#2E7D32','#388E3C','#43A047','#4CAF50','#66BB6A','#81C784','#A5D6A7','#C8E6C9','#1B5E20','#2E7D32','#388E3C','#43A047'];
    return b.slice(0, Math.max(n, 1));
  }

  _destroy(id) { if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; } }
  destroyAll() { Object.keys(this.charts).forEach(id => this._destroy(id)); }
}

const chartRenderer = new ChartRenderer();
