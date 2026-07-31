import api from '../api.js';
import { currentUser, formatCurrency, toast, navigate } from '../app.js';

const COINS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { id: 'usdt', name: 'Tether', symbol: 'USDT', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', icon: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
  { id: 'bnb', name: 'BNB', symbol: 'BNB', icon: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', icon: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { id: 'trx', name: 'TRON', symbol: 'TRX', icon: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png' },
  { id: 'xrp', name: 'XRP', symbol: 'XRP', icon: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC', icon: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', icon: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
];

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Withdraw Funds</h1>
          <p class="page-subtitle">Withdraw funds to any crypto wallet.</p>
        </div>
      </div>

      <div class="grid-2-aside" style="gap:24px;align-items:start;">
        <div>
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><div class="card-title">Available Balance</div></div>
            <div class="card-body">
              <div style="font-size:32px;font-weight:700;color:#0f172a;" id="availBal">Loading...</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Main balance available for withdrawal</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">New Withdrawal</div></div>
            <div class="card-body">

              <div class="form-row">
                <label class="input-label">Select Crypto to Receive</label>
                <div class="coin-grid" id="coinGrid">
                  ${COINS.map(c => `
                    <button class="coin-select-btn" data-coin="${c.id}" title="${c.name}">
                      <img src="${c.icon}" alt="${c.symbol}" onerror="this.style.display='none'">
                      <span>${c.symbol}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="form-row">
                <label class="input-label">Amount (USD)</label>
                <div style="position:relative;">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:600;">$</span>
                  <input id="withdrawAmount" class="input-field" type="number" min="1" step="0.01" placeholder="0.00" style="padding-left:28px;">
                </div>
                <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
                  Funds will be deducted from your main balance. If insufficient, crypto wallet balance will be used.
                </div>
              </div>

              <div class="form-row">
                <label class="input-label">Your <span id="walletCoinLabel">Crypto</span> Wallet Address</label>
                <input id="walletAddress" class="input-field mono" placeholder="Enter your wallet address" style="font-size:12px;">
                <div style="font-size:11px;color:#f59e0b;margin-top:4px;">⚠ Double-check your wallet address. Transactions cannot be reversed.</div>
              </div>

              <div class="form-row">
                <label class="input-label">Withdrawal Password</label>
                <div class="password-wrap">
                  <input id="withdrawPass" class="input-field" type="password" placeholder="Enter your withdrawal password">
                  <button type="button" class="password-toggle" id="togglePass">👁</button>
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;">
                  Don't have one? <a href="#" id="setPassLink" style="color:#22c55e;">Set withdrawal password</a>
                </div>
              </div>

              <div id="withdraw-summary" class="withdraw-summary hidden"></div>

              <button class="btn btn-primary btn-w100" id="submitWithdrawBtn" disabled>
                Select a crypto coin first
              </button>

            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-header"><div class="card-title">Withdrawal History</div></div>
            <div class="card-body" id="withdrawHistoryShort"><div class="loading-spinner-wrap"><div class="spinner"></div></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load balance
  try {
    const portfolio = await api.portfolio();
    const balance = Number(portfolio.balance || 0);
    document.getElementById('availBal').textContent = formatCurrency(balance);
  } catch {
    document.getElementById('availBal').textContent = formatCurrency(currentUser?.balance || 0);
  }

  // Load short history
  loadShortHistory();

  // Toggle password
  document.getElementById('togglePass').addEventListener('click', function () {
    const inp = document.getElementById('withdrawPass');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    this.textContent = inp.type === 'password' ? '👁' : '🙈';
  });

  // Set pass link
  document.getElementById('setPassLink').addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/security');
  });

  // Coin selection
  let selectedCoin = null;
  document.getElementById('coinGrid').querySelectorAll('.coin-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.coin-select-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCoin = btn.dataset.coin;
      const coin = COINS.find(c => c.id === selectedCoin);
      document.getElementById('walletCoinLabel').textContent = coin ? coin.symbol : 'Crypto';
      document.getElementById('walletAddress').placeholder = `Your ${coin?.symbol || 'crypto'} wallet address`;
      document.getElementById('submitWithdrawBtn').disabled = false;
      document.getElementById('submitWithdrawBtn').textContent = `Submit Withdrawal in ${coin?.symbol}`;
    });
  });

  // Amount change → update summary
  document.getElementById('withdrawAmount').addEventListener('input', updateSummary);

  function updateSummary() {
    const amt = parseFloat(document.getElementById('withdrawAmount').value);
    const summary = document.getElementById('withdraw-summary');
    if (!isNaN(amt) && amt > 0 && selectedCoin) {
      const coin = COINS.find(c => c.id === selectedCoin);
      summary.innerHTML = `
        <div class="summary-row"><span>Withdrawing</span><span>$${amt.toFixed(2)}</span></div>
        <div class="summary-row"><span>To wallet</span><span>${coin?.name} (${coin?.symbol})</span></div>
        <div class="summary-row"><span>Approval</span><span style="color:#f59e0b;">Admin review required</span></div>
      `;
      summary.classList.remove('hidden');
    } else {
      summary.classList.add('hidden');
    }
  }

  // Submit
  document.getElementById('submitWithdrawBtn').addEventListener('click', async function () {
    if (!selectedCoin) { toast('Please select a crypto coin', 'error'); return; }
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const walletAddress = document.getElementById('walletAddress').value.trim();
    const withdrawalPassword = document.getElementById('withdrawPass').value;

    if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (!walletAddress) { toast('Enter your wallet address', 'error'); return; }
    if (!withdrawalPassword) { toast('Enter your withdrawal password', 'error'); return; }

    this.disabled = true;
    this.textContent = 'Submitting...';

    try {
      await api.submitWithdrawal(selectedCoin, amount, walletAddress, withdrawalPassword);
      toast('Withdrawal request submitted! Pending admin approval.', 'success');

      // Reset form
      document.getElementById('withdrawAmount').value = '';
      document.getElementById('walletAddress').value = '';
      document.getElementById('withdrawPass').value = '';
      document.querySelectorAll('.coin-select-btn').forEach(b => b.classList.remove('selected'));
      selectedCoin = null;
      this.disabled = true;
      this.textContent = 'Select a crypto coin first';
      document.getElementById('withdraw-summary').classList.add('hidden');
      loadShortHistory();
    } catch (err) {
      toast(err.message, 'error');
      this.disabled = false;
      this.textContent = `Submit Withdrawal in ${COINS.find(c => c.id === selectedCoin)?.symbol}`;
    }
  });
}

async function loadShortHistory() {
  const el = document.getElementById('withdrawHistoryShort');
  if (!el) return;
  try {
    const withdrawals = await api.myWithdrawals();
    if (!withdrawals.length) {
      el.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8;">No withdrawals yet.</div>`;
      return;
    }
    el.innerHTML = withdrawals.slice(0, 10).map(w => {
      const statusClass = w.status === 'approved' ? 'green' : w.status === 'declined' ? 'red' : 'orange';
      const statusLabel = w.status === 'approved' ? '✓ Completed' : w.status === 'declined' ? '✗ Declined' : '⏳ Pending';
      return `
        <div style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:600;font-size:14px;">${w.currency?.toUpperCase()} Withdrawal</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">${new Date(w.created_at).toLocaleString()}</div>
              ${w.decline_reason ? `<div style="font-size:11px;color:#ef4444;margin-top:2px;">Reason: ${w.decline_reason}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:#ef4444;">-${formatCurrency(w.amount)}</div>
              <div style="font-size:11px;color:#${statusClass === 'green' ? '22c55e' : statusClass === 'red' ? 'ef4444' : 'f59e0b'};">${statusLabel}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (withdrawals.length > 10) {
      el.innerHTML += `<button class="btn btn-ghost btn-w100" style="margin-top:12px;" onclick="navigate('/withdrawals')">View All</button>`;
    }
  } catch (err) {
    el.innerHTML = `<div style="color:#ef4444;padding:16px;">${err.message}</div>`;
  }
}
