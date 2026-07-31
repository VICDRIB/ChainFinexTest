import api from '../api.js';
import { currentUser, formatCurrency, navigate, toast } from '../app.js';
import { t } from '../translations.js';

const DEFAULT_PLANS = [
  {
    id: 1,
    name: 'Basic',
    price: 49,
    icon: '🌱',
    description: 'Perfect for beginners looking to grow their investment with professional management.',
    features: [
      'Professional account management',
      'Daily performance updates',
      'Basic risk management',
      'Email support',
    ],
  },
  {
    id: 2,
    name: 'Standard',
    price: 149,
    icon: '⚡',
    popular: true,
    description: 'Our most popular plan with enhanced features for steady growth.',
    features: [
      'Advanced account management',
      'Real-time portfolio monitoring',
      'Advanced risk management',
      'Priority email & chat support',
      'Weekly performance report',
    ],
  },
  {
    id: 3,
    name: 'Premium',
    price: 349,
    icon: '💎',
    description: 'Maximum exposure with a dedicated account manager for serious investors.',
    features: [
      'Dedicated account manager',
      'High-frequency trading strategies',
      'Institutional-grade risk tools',
      '24/7 priority support',
      'Daily performance reports',
      'Custom strategy consultation',
    ],
  },
  {
    id: 4,
    name: 'Enterprise',
    price: 999,
    icon: '🏛️',
    description: 'Full-service VIP management for high-net-worth individuals.',
    features: [
      'VIP dedicated team',
      'Custom trading strategies',
      'Full portfolio diversification',
      'Direct phone & video support',
      'Real-time 24/7 monitoring',
      'Monthly in-depth analysis',
      'Exclusive market intelligence',
    ],
  },
];

export async function render(container) {
  let plans = DEFAULT_PLANS;
  try {
    const fetched = await api.managedAccountPlans();
    if (Array.isArray(fetched) && fetched.length > 0) plans = fetched;
  } catch {}

  let selectedPlanId = null;

  function renderPage() {
    container.innerHTML = `
      <div class="page-inner">
        <div class="page-header">
          <div>
            <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
            <h1 class="page-title" style="margin-top:10px;">${t('choose_plan')}</h1>
            <p class="page-subtitle">${t('subscription_desc')}</p>
          </div>
        </div>

        <div class="sub-plan-grid">
          ${plans.map(plan => `
            <div class="sub-plan-card ${selectedPlanId === (plan.id || plan.name) ? 'selected' : ''}"
                 data-id="${plan.id || plan.name}" data-price="${plan.price}" data-name="${plan.name}">
              ${plan.popular ? `<div class="sub-plan-popular">⭐ Most Popular</div>` : ''}
              <span class="sub-plan-icon">${plan.icon || '📊'}</span>
              <div class="sub-plan-name">${plan.name}</div>
              <div class="sub-plan-price">${formatCurrency(plan.price)}</div>
              <div class="sub-plan-period">/ month</div>
              <div class="sub-plan-features">
                ${(plan.features || []).map(f => `<div class="sub-plan-feature">${f}</div>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card" style="margin-top:28px;max-width:520px;margin-left:auto;margin-right:auto;" id="confirm-section" ${!selectedPlanId ? 'style="display:none;"' : ''}>
          <div class="card-header">
            <div class="card-title">Confirm Subscription</div>
          </div>
          <div class="card-body" id="confirm-body">
            <p style="color:#64748b;font-size:13px;margin-bottom:16px;">Select a plan above to continue.</p>
          </div>
        </div>

        <div style="text-align:center;margin-top:20px;">
          <p style="font-size:12px;color:#94a3b8;">${t('managed_account_terms')}</p>
          <p style="font-size:12px;color:#64748b;margin-top:4px;">${t('managed_account_contact')}</p>
        </div>
      </div>
    `;

    // Attach card click handlers
    container.querySelectorAll('.sub-plan-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.sub-plan-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPlanId = card.dataset.id;

        const price = parseFloat(card.dataset.price);
        const name = card.dataset.name;
        const confirmSection = container.querySelector('#confirm-section');
        const confirmBody = container.querySelector('#confirm-body');
        if (confirmSection) confirmSection.style.display = '';
        if (confirmBody) {
          confirmBody.innerHTML = `
            <div class="drawer-item">
              <span>Plan</span>
              <strong>${name}</strong>
            </div>
            <div class="drawer-item">
              <span>Monthly Fee</span>
              <strong style="color:#22c55e;">${formatCurrency(price)}</strong>
            </div>
            <div class="drawer-item">
              <span>Billing</span>
              <strong>Monthly</strong>
            </div>
            <div style="margin-top:16px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:13px;color:#15803d;margin-bottom:16px;">
              🛡️ After subscribing, our team will contact you at <strong>${window.__userEmail || 'your registered email'}</strong> to set up your account management.
            </div>
            <button class="btn btn-primary btn-w100" id="subscribe-confirm-btn" style="font-size:14px;padding:13px;">
              ${t('subscribe')} — ${formatCurrency(price)}/month
            </button>
          `;
          document.getElementById('subscribe-confirm-btn').addEventListener('click', doSubscribe);
        }
      });
    });
  }

  async function doSubscribe() {
    const btn = document.getElementById('subscribe-confirm-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Processing...';
    try {
      const plan = plans.find(
        p => String(p.id) === String(selectedPlanId)
    );
    
    if (!plan) {
        toast("Invalid plan selected.", "error");
        return;
    }
    
    if (currentUser.balance < plan.price) {
        toast("Insufficient Main Balance.", "error");
        btn.disabled = false;
        btn.textContent = `${t('subscribe')}`;
        return;
    }

    const result = await api.subscribeManagedAccount(selectedPlanId);

    // Update the logged-in user's balance
    if (result?.balance !== undefined) {
        currentUser.balance = result.balance;
    }
    
    toast(
        'Subscription successful! Our team will contact you shortly.',
        'success'
    );
    
    navigate('/managed-account');
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = `${t('subscribe')}`;
    }
  }

  renderPage();
}
