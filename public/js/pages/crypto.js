import api from '../api.js';
import { navigate, formatBigNum, toast } from '../app.js';

let refreshTimer = null;

export async function render(container) {
  if (refreshTimer) clearInterval(refreshTimer);

  container.innerHTML = `<div class="page-inner">
    <div class="page-header">
      <div>
        <h1 class="page-title">Crypto Market</h1>
        <p class="page-subtitle">Live cryptocurrency prices and market data.</p>
      </div>
      <span class="live-badge"><span class="live-dot"></span> Live · auto-refresh 30s</span>
    </div>
    <div class="grid-3" id="coins-grid">
      ${Array(6).fill(skeletonCoinCard()).join('')}
    </div>
  </div>`;

  await loadCoins();
  refreshTimer = setInterval(loadCoins, 30000);

  // Clean up timer when navigating away
  window.addEventListener('popstate', () => clearInterval(refreshTimer), { once: true });
}

async function loadCoins() {
  try {
    const coins = await api.cryptoCoins();
    const grid = document.getElementById('coins-grid');
    if (!grid) { clearInterval(refreshTimer); return; }
    if (!coins || coins.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:#94a3b8;">No market data available</div>`;
      return;
    }
    grid.innerHTML = coins.map((coin, i) => renderCoinCard(coin, i)).join('');
    grid.querySelectorAll('.coin-card').forEach(card => {
      card.addEventListener('click', () => navigate(`/crypto/${card.dataset.id}`));
    });
  } catch (e) {
    const grid = document.getElementById('coins-grid');
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:#94a3b8;">Failed to load market data — check your internet connection</div>`;
  }
}

function renderCoinCard(coin, i) {
  const pos = coin.price_change_percentage_24h >= 0;
  const changeStr = `${pos ? '+' : ''}${coin.price_change_percentage_24h?.toFixed(2) ?? '0.00'}%`;
  const price = coin.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) ?? '—';
  return `
    <div class="card coin-card stagger-item" data-id="${coin.id}">
      <div class="coin-header">
        <img class="coin-img" src="${coin.image}" loading="lazy" alt="${coin.name}" onerror="this.style.display='none'"/>
        <div>
          <div class="coin-name">${coin.name}</div>
          <div class="coin-symbol">${coin.symbol?.toUpperCase()}</div>
        </div>
      </div>
      <div class="coin-price">$${price}</div>
      <div class="coin-change ${pos ? 'pos' : 'neg'}">${pos ? '▲' : '▼'} ${changeStr} <span style="font-weight:400;color:#94a3b8;font-size:11px;">24h</span></div>
      <div class="coin-stats">
        <div>
          <div class="coin-stat-label">Market Cap</div>
          <div class="coin-stat-val">${formatBigNum(coin.market_cap)}</div>
        </div>
        <div>
          <div class="coin-stat-label">24h Volume</div>
          <div class="coin-stat-val">${formatBigNum(coin.total_volume)}</div>
        </div>
      </div>
    </div>`;
}

function skeletonCoinCard() {
  return `<div class="card" style="padding:20px;">
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div class="skeleton" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;"></div>
      <div style="flex:1"><div class="skeleton" style="height:13px;width:70%;margin-bottom:6px;"></div><div class="skeleton" style="height:11px;width:30%;"></div></div>
    </div>
    <div class="skeleton" style="height:28px;width:60%;margin-bottom:8px;"></div>
    <div class="skeleton" style="height:13px;width:35%;margin-bottom:16px;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:12px;border-top:1px solid #f1f5f9;">
      <div><div class="skeleton" style="height:10px;width:80%;margin-bottom:4px;"></div><div class="skeleton" style="height:13px;width:60%;"></div></div>
      <div><div class="skeleton" style="height:10px;width:80%;margin-bottom:4px;"></div><div class="skeleton" style="height:13px;width:60%;"></div></div>
    </div>
  </div>`;
}
