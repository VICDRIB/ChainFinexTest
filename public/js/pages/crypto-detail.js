import api from '../api.js';
import { navigate, formatBigNum } from '../app.js';

let chart = null;
let refreshTimer = null;

export async function render(container, params) {
  if (refreshTimer) clearInterval(refreshTimer);
  if (chart) { chart.destroy(); chart = null; }

  const coinId = params.coinId;

  container.innerHTML = `<div class="page-inner">
    <button class="back-btn btn-secondary" id="back-btn">← Back to Crypto Market</button>
    <div id="coin-header" style="margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div class="skeleton" style="width:48px;height:48px;border-radius:50%;flex-shrink:0;"></div>
        <div><div class="skeleton" style="height:28px;width:180px;margin-bottom:8px;"></div><div class="skeleton" style="height:22px;width:120px;"></div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-bottom:16px;">
        <span class="card-title">Price Chart</span>
        <div class="day-selector" id="day-selector">
          ${['1','7','30','90'].map(d => `<button class="day-btn ${d==='7'?'active':''}" data-days="${d}">${d==='1'?'1D':d+'D'}</button>`).join('')}
        </div>
      </div>
      <div class="card-body">
        <div class="chart-wrap"><canvas id="price-chart"></canvas></div>
      </div>
    </div>
    <div class="grid-3" id="stat-cards">
      ${[1,2,3].map(() => `<div class="card" style="padding:20px;"><div class="skeleton" style="height:10px;width:60%;margin-bottom:8px;"></div><div class="skeleton" style="height:24px;width:70%;"></div></div>`).join('')}
    </div>
  </div>`;

  document.getElementById('back-btn').addEventListener('click', () => navigate('/crypto'));

  let currentDays = '7';

  async function loadAll() {
    const [coinsRes, chartRes] = await Promise.allSettled([
      api.cryptoCoins(),
      api.cryptoChart(coinId, currentDays),
    ]);

    // Coin header
    if (coinsRes.status === 'fulfilled') {
      const coin = coinsRes.value.find(c => c.id === coinId);
      if (coin) renderCoinHeader(coin);
    }

    // Chart
    if (chartRes.status === 'fulfilled') {
      renderChart(chartRes.value, currentDays);
    }
  }

  document.getElementById('day-selector').addEventListener('click', async e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = btn.dataset.days;
    if (chart) { chart.destroy(); chart = null; }
    try {
      const data = await api.cryptoChart(coinId, currentDays);
      renderChart(data, currentDays);
    } catch {}
  });

  await loadAll();
  refreshTimer = setInterval(loadAll, 15000);
  window.addEventListener('popstate', () => { clearInterval(refreshTimer); if (chart) chart.destroy(); }, { once: true });
}

function renderCoinHeader(coin) {
  const pos = coin.price_change_percentage_24h >= 0;
  const header = document.getElementById('coin-header');
  if (!header) return;
  header.innerHTML = `
    <div class="coin-detail-header">
      <img
    class="coin-detail-img"
    src="${coin.image}"
    alt="${coin.name}"
    width="64"
    height="64"
    onerror="this.style.display='none'" onerror="this.style.display='none'"/>
      <div class="coin-detail-info">
        <div class="coin-detail-title">
          <span class="coin-detail-name">${coin.name}</span>
          <span class="coin-symbol">${coin.symbol?.toUpperCase()}</span>
        </div>
        <div class="coin-detail-price-row">
          <span class="coin-detail-price">
            $${coin.current_price?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:8})}
          </span>
          <span class="coin-detail-change ${pos?'positive':'negative'}">
            ${pos?'▲':'▼'} ${pos?'+':''}${coin.price_change_percentage_24h?.toFixed(2)}% 24h
          </span>
        </div>
      </div>
    </div>`;

  const statCards = document.getElementById('stat-cards');
  if (statCards) {
    statCards.innerHTML = [
      { label: 'Market Cap', val: formatBigNum(coin.market_cap) },
      { label: '24h Volume', val: formatBigNum(coin.total_volume) },
      { label: '24h Change', val: `${pos?'+':''}${coin.price_change_percentage_24h?.toFixed(2)}%`, color: pos?'#22c55e':'#ef4444' },
    ].map(s => `
      <div class="card stagger-item" style="padding:20px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">${s.label}</div>
        <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${s.color||'#0f172a'};">${s.val}</div>
      </div>`).join('');
  }
}

function renderChart(data, days) {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  if (chart) { chart.destroy(); chart = null; }
  const prices = data?.prices || [];
  if (!prices.length) return;

  const labels = prices.map(([ts]) => {
    const d = new Date(ts);
    return days === '1' ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = prices.map(([, v]) => v);

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#22c55e',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          gradient.addColorStop(0, 'rgba(34,197,94,0.2)');
          gradient.addColorStop(1, 'rgba(34,197,94,0)');
          return gradient;
        },
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#f1f5f9',
          callbacks: {
            label: ctx => `$${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 8 },
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#94a3b8', font: { size: 11 },
            callback: v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:4})}`,
          },
        },
      },
    },
  });
}
