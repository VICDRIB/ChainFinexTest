import api from '../api.js';
import { toast, timeAgo } from '../app.js';

const COIN_CFG = {
  btc:  { name: 'Bitcoin',      symbol: 'BTC',  network: 'Bitcoin Network',      icon: '₿', iconBg: '#f59e0b' },
  eth:  { name: 'Ethereum',     symbol: 'ETH',  network: 'Ethereum Network',     icon: 'Ξ', iconBg: '#6366f1' },
  usdt: { name: 'Tether USDT',  symbol: 'USDT', network: 'TRC-20 Network',       icon: '₮', iconBg: '#22c55e' },
  usdc: { name: 'USD Coin',     symbol: 'USDC', network: 'ERC-20 Network',       icon: '💵', iconBg: '#2775ca' },
  bnb:  { name: 'BNB',          symbol: 'BNB',  network: 'BNB Smart Chain',      icon: '🟡', iconBg: '#f3ba2f' },
  sol:  { name: 'Solana',       symbol: 'SOL',  network: 'Solana Network',       icon: '◎', iconBg: '#9945ff' },
  trx:  { name: 'TRON',         symbol: 'TRX',  network: 'TRON Network',         icon: '🔺', iconBg: '#ef0027' },
  xrp:  { name: 'XRP',          symbol: 'XRP',  network: 'XRP Ledger',           icon: '✕', iconBg: '#111827' },
  ltc:  { name: 'Litecoin',     symbol: 'LTC',  network: 'Litecoin Network',     icon: 'Ł', iconBg: '#345d9d' },
  doge: { name: 'Dogecoin',     symbol: 'DOGE', network: 'Dogecoin Network',     icon: 'Ð', iconBg: '#c2a633' }
};

export async function render(container) {
  container.innerHTML = `<div class="page-inner">
    <div class="page-header">
      <div>
        <h1 class="page-title">Payment Addresses</h1>
        <p class="page-subtitle">Configure wallet addresses shown to users for deposits.</p>
      </div>
    </div>
    <div id="addresses-wrap">
      ${[1,2,3].map(() => `<div class="card addr-card" style="margin-bottom:12px;">
        <div class="skeleton" style="height:40px;width:60%;margin-bottom:16px;"></div>
        <div class="skeleton" style="height:40px;width:100%;"></div>
      </div>`).join('')}
    </div>
    <div class="save-row">
      <button class="btn btn-primary" id="save-btn" disabled>Save All Changes</button>
    </div>
  </div>`;

  let addressData = {};

  try {
    const list = await api.paymentAddresses();
    list.forEach(a => { addressData[a.type.toLowerCase()] = { address: a.address || '', label: a.label || '', updatedAt: a.updated_at || a.updatedAt }; });
  } catch (err) {
    document.getElementById('addresses-wrap').innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center;">${err.message}</div>`;
    return;
  }

  const wrap = document.getElementById('addresses-wrap');
  wrap.innerHTML = Object.keys(COIN_CFG).map(type => {
    const cfg = COIN_CFG[type];
    const data = addressData[type] || {};
    const ago = data.updatedAt ? `Last updated: ${timeAgo(data.updatedAt)}` : '';
    return `<div class="card addr-card stagger-item">
      <div class="addr-header">
        <div class="addr-coin-icon" style="background:${cfg.iconBg};">${cfg.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px;color:#0f172a;">${cfg.name}</div>
          <div style="font-size:11px;color:#64748b;">${cfg.network}</div>
        </div>
        ${ago ? `<span style="font-size:11px;color:#94a3b8;font-family:'JetBrains Mono',monospace;">${ago}</span>` : ''}
      </div>
      <div>
        <label class="input-label" style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-family:'JetBrains Mono',monospace;">Wallet Address</label>
        <input class="addr-input" id="addr-${type}" type="text" value="${data.address || ''}" placeholder="Enter ${cfg.symbol} wallet address…" />
      </div>
    </div>`;
  }).join('');

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = false;

  // Enable save on any change
  wrap.querySelectorAll('.addr-input').forEach(input => {
    input.addEventListener('input', () => { saveBtn.disabled = false; });
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const payload = Object.entries(COIN_CFG).map(([type, cfg]) => ({
        type,
        address: document.getElementById(`addr-${type}`)?.value || '',
        label: `${cfg.name} (${cfg.symbol})`
      }));
      
      await api.savePaymentAddresses(...payload);
      toast('Payment addresses saved successfully!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save All Changes';
    }
  });
}
