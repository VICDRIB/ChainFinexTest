import api from '../api.js';
import { toast, navigate } from '../app.js';

const COIN_CFG = {
  btc: {
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin Network',
    icon: '/logos/bitcoin-btc-logo.svg',
    accentColor: '#f59e0b',
    selectedClass: 'selected-btc',
    symbolColor: '#f59e0b'
  },

  usdt: {
    name: 'Tether USDT',
    symbol: 'USDT',
    network: 'TRC-20 Network',
    icon: '/logos/tether-usdt-logo.svg',
    accentColor: '#22c55e',
    selectedClass: 'selected-usdt',
    symbolColor: '#22c55e'
  },

  eth: {
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Ethereum Network',
    icon: '/logos/ethereum-eth-logo.svg',
    accentColor: '#6366f1',
    selectedClass: 'selected-eth',
    symbolColor: '#6366f1'
  },

  bnb: {
    name: 'BNB',
    symbol: 'BNB',
    network: 'BNB Smart Chain',
    icon: '/logos/bnb-bnb-logo.svg',
    accentColor: '#f3ba2f',
    selectedClass: 'selected-bnb',
    symbolColor: '#f3ba2f'
  },

  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    network: 'ERC-20 Network',
    icon: '/logos/usd-coin-usdc-logo.svg',
    accentColor: '#2775ca',
    selectedClass: 'selected-usdc',
    symbolColor: '#2775ca'
  },

  xrp: {
    name: 'XRP',
    symbol: 'XRP',
    network: 'XRP Ledger',
    icon: '/logos/xrp-xrp-logo.svg',
    accentColor: '#111827',
    selectedClass: 'selected-xrp',
    symbolColor: '#111827'
  },

  sol: {
    name: 'Solana',
    symbol: 'SOL',
    network: 'Solana Network',
    icon: '/logos/solana-sol-logo.svg',
    accentColor: '#9945ff',
    selectedClass: 'selected-sol',
    symbolColor: '#9945ff'
  },

  trx: {
    name: 'TRON',
    symbol: 'TRX',
    network: 'TRON Network',
    icon: '/logos/tron-trx-logo.svg',
    accentColor: '#ef0027',
    selectedClass: 'selected-trx',
    symbolColor: '#ef0027'
  },

  ltc: {
    name: 'Litecoin',
    symbol: 'LTC',
    network: 'Litecoin Network',
    icon: '/logos/litecoin-ltc-logo.svg',
    accentColor: '#345d9d',
    selectedClass: 'selected-ltc',
    symbolColor: '#345d9d'
  },

  doge: {
    name: 'Dogecoin',
    symbol: 'DOGE',
    network: 'Dogecoin Network',
    icon: '/logos/dogecoin-doge-logo.svg',
    accentColor: '#c2a633',
    selectedClass: 'selected-doge',
    symbolColor: '#c2a633'
  }
};

export async function render(container) {
  let step = 'amount'; // amount | payment | confirmed
  let selectedAmount = '';
  let selectedMethod = null;
  let addresses = {};
  let submittedAt = null;
  let direction = 'forward';

  try {
    const list = await api.paymentAddresses();
    list.forEach(a => { addresses[a.type.toLowerCase()] = a.address || ''; });
  } catch {}

  function stepIndex(s) { return ['amount','payment','confirmed'].indexOf(s); }

  function stepIndicatorHTML() {
    const steps = ['Amount','Payment','Confirmed'];
    return steps.map((label, i) => {
      const idx = stepIndex(step);
      const cls = i < idx ? 'done' : i === idx ? 'active' : 'pending';
      const icon = i < idx ? '✓' : i + 1;
      return `
        ${i > 0 ? '<div class="step-divider"></div>' : ''}
        <div class="step-dot ${cls}">${icon}</div>
        <span class="step-label ${cls === 'pending' ? 'pending' : 'active'}">${label}</span>
      `;
    }).join('');
  }

  function renderStep() {
    const inner = document.getElementById('payments-inner');
    if (!inner) return;

    inner.style.opacity = '0';
    inner.style.transform = direction === 'forward' ? 'translateX(40px)' : 'translateX(-40px)';
    requestAnimationFrame(() => {
      inner.style.transition = 'opacity 0.2s ease,transform 0.2s ease';
      inner.style.opacity = '1';
      inner.style.transform = 'translateX(0)';
    });

    // Update step indicators
    const stepEl = document.getElementById('step-indicator');
    if (stepEl) stepEl.innerHTML = stepIndicatorHTML();

    if (step === 'amount') renderAmountStep(inner);
    else if (step === 'payment') renderPaymentStep(inner);
    else renderConfirmedStep(inner);
  }

  function renderAmountStep(el) {
    el.innerHTML = `<div class="payment-max-wrap">
      <div class="card card-body">
        <div class="payment-header">
          <h2 class="payment-title">How much would you like to deposit?</h2>
          <p class="payment-subtitle">Select an amount and payment method to continue.</p>
        </div>
        <div class="form-row">
          <label class="input-label">Amount (USD)</label>
          <div class="amount-input-wrap">
            <span class="amount-prefix">$</span>
            <input type="number" id="amount-input" class="amount-input" min="1" step="0.01" placeholder="0.00" value="${selectedAmount}" />
          </div>
        </div>
        <div class="form-row">
          <label class="input-label">Payment Method</label>
          ${[
            'btc',
            'eth',
            'usdt',
            'usdc',
            'bnb',
            'sol',
            'trx',
            'xrp',
            'ltc',
            'doge'
          ].map(type => {
            const cfg = COIN_CFG[type];
            const isSel = selectedMethod === type;
            return `
              <div class="method-option ${isSel ? cfg.selectedClass : ''}" data-method="${type}">
                <div class="method-coin-icon">
    <img src="${cfg.icon}" alt="${cfg.symbol}">
</div>
                <div>
                  <div class="method-name">${cfg.name}</div>
                  <div class="method-network">${cfg.network}</div>
                </div>
                <span class="method-symbol" style="color:${cfg.symbolColor};">${cfg.symbol}</span>
                ${isSel ? '<div class="check-circle">✓</div>' : ''}
              </div>`;
          }).join('')}
        </div>
        <button class="btn btn-primary btn-w100" id="continue-btn" ${(!selectedAmount || !selectedMethod) ? 'disabled' : ''}>Continue to Payment →</button>
      </div>
    </div>`;

    const amtInput = el.querySelector('#amount-input');
    amtInput.addEventListener('input', () => {
      selectedAmount = amtInput.value;
      el.querySelector('#continue-btn').disabled = !selectedAmount || parseFloat(selectedAmount) <= 0 || !selectedMethod;
    });

    el.querySelectorAll('.method-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const method = opt.dataset.method;
    
        // Don't allow selecting coins without an address
        if (!addresses[method]) {
          toast(
            "This payment method is currently unavailable. Please choose another cryptocurrency.",
            "error"
          );
          return;
        }
    
        selectedMethod = method;
        renderStep();
      });
    });

    el.querySelector('#continue-btn').addEventListener('click', () => {
      direction = 'forward'; step = 'payment'; renderStep();
    });
  }

  function renderPaymentStep(el) {
    const cfg = COIN_CFG[selectedMethod];
    const walletAddr = addresses[selectedMethod] || '';
    el.innerHTML = `<div class="payment-max-wrap">
      <div class="card card-body">
        <div class="payment-method-header">
          <div class="method-coin-icon payment-icon">
    <img src="${cfg.icon}" alt="${cfg.symbol}">
</div>
          <div class="payment-method-info">
            <div class="payment-method-title">${cfg.name}</div>
            <div class="payment-method-network">${cfg.network}</div>
          </div>
          <span
          class="payment-method-symbol"
          style="color:${cfg.symbolColor};">${cfg.symbol}</span>
        </div>
        <div class="payment-amount">
          <p class="payment-amount-label">Send exactly</p>
          <p class="payment-amount-value">$${parseFloat(selectedAmount).toFixed(2)} <span
          class="payment-amount-coin"
          style="color:${cfg.symbolColor};">worth of ${cfg.symbol}</span></p>
        </div>
        ${walletAddr
          ? `<div style="margin-bottom:12px;">
               <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">Wallet Address</div>
               <div class="address-box">${walletAddr}</div>
             </div>
             <button class="btn btn-ghost btn-w100 copy-btn" id="copy-btn">📋 Copy Address</button>`
          : `<div style="text-align:center;padding:20px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:8px;margin-bottom:16px;font-size:13px;">Address not configured. Contact an admin.</div>`
        }
        <div class="warning-box" style="margin-bottom:20px;"><strong>Important:</strong> Only send ${cfg.symbol} to this address.</div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="back-btn">← Change Method</button>
          <button class="btn btn-primary" id="submit-btn">I've Sent the Payment →</button>
        </div>
      </div>
    </div>`;

    if (walletAddr) {
      el.querySelector('#copy-btn').addEventListener('click', async function() {
        try {
          await navigator.clipboard.writeText(walletAddr);
          this.textContent = '✓ Copied!';
          this.classList.add('copied');
          toast('Address copied to clipboard!', 'success');
          setTimeout(() => { this.textContent = '📋 Copy Address'; this.classList.remove('copied'); }, 2000);
        } catch { toast('Failed to copy', 'error'); }
      });
    }

    el.querySelector('#back-btn').addEventListener('click', () => { direction = 'backward'; step = 'amount'; renderStep(); });
    el.querySelector('#submit-btn').addEventListener('click', async function() {
      this.disabled = true;
      this.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 auto;"></div>';
      try {
        await api.submitPayment(selectedAmount, selectedMethod);
        submittedAt = new Date();
        direction = 'forward'; step = 'confirmed'; renderStep();
      } catch (err) {
        toast(err.message || 'Failed to submit payment', 'error');
        this.disabled = false;
        this.textContent = "I've Sent the Payment →";
      }
    });
  }

  function renderConfirmedStep(el) {
    const cfg = COIN_CFG[selectedMethod];
    el.innerHTML = `<div class="payment-max-wrap">
      <div class="card card-body" style="text-align:center;padding:40px 32px;">
        <span class="confirmed-icon">✅</span>
        <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px;">Payment Submitted!</h2>
        <p style="font-size:15px;font-weight:500;color:#f59e0b;margin-bottom:6px;">Pending...</p>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:24px;">Our team has been notified and will verify your payment shortly.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:left;margin-bottom:24px;">
          <div class="payment-detail-row"><span style="color:#64748b;">Amount</span><span style="font-family:'JetBrains Mono',monospace;font-weight:700;">$${parseFloat(selectedAmount).toFixed(2)}</span></div>
          <div class="payment-detail-row"><span style="color:#64748b;">Method</span><span style="display:flex;align-items:center;gap:8px;">
    <img src="${cfg.icon}"
         style="width:22px;height:22px;">
    ${cfg.name} (${cfg.symbol})
</span></div>
          <div class="payment-detail-row"><span style="color:#64748b;">Submitted</span><span style="font-family:'JetBrains Mono',monospace;font-size:11px;">${submittedAt?.toLocaleString()}</span></div>
        </div>
        <button class="btn btn-primary btn-w100" id="to-dashboard">Back to Dashboard</button>
        <button class="btn btn-ghost btn-w100" id="another">Make another deposit</button>
      </div>
    </div>`;

    el.querySelector('#to-dashboard').addEventListener('click', () => navigate('/dashboard'));
    el.querySelector('#another').addEventListener('click', () => {
      selectedAmount = ''; selectedMethod = null; submittedAt = null;
      direction = 'backward'; step = 'amount'; renderStep();
    });
  }

  container.innerHTML = `<div class="page-inner">
    <div class="page-header"><div>
      <h1 class="page-title">Deposit Funds</h1>
      <p class="page-subtitle">Fund your account securely with cryptocurrency.</p>
    </div></div>
    <div class="step-indicator" id="step-indicator">${stepIndicatorHTML()}</div>
    <div id="payments-inner" style="position:relative;overflow:hidden;"></div>
  </div>`;

  renderStep();
}
