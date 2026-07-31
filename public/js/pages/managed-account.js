import api from '../api.js';
import { currentUser, formatCurrency, navigate, toast } from '../app.js';
import { t } from '../translations.js';

export async function render(container) {
  container.innerHTML = `<div class="page-inner"><div class="loading-spinner-wrap"><div class="spinner"></div></div></div>`;

  let subscription = null;
  try {
    subscription = await api.myManagedAccount();
  } catch {
    subscription = null;
  }

  if (!subscription) {
    // Show promo page
    container.innerHTML = `
      <div class="page-inner">
        <div class="page-header">
          <div>
            <h1 class="page-title">${t('managed_account')}</h1>
            <p class="page-subtitle">Professional account management service</p>
          </div>
        </div>

        <div class="managed-promo-card">
          <span class="managed-promo-icon">🏦</span>
          <h2 class="managed-promo-title">${t('managed_account_title')}</h2>
          <p class="managed-promo-desc">${t('managed_account_desc')}</p>
          <p class="managed-promo-terms">${t('managed_account_terms')}</p>
          <p class="managed-promo-contact">${t('managed_account_contact')}</p>
          <button class="managed-promo-btn" id="subscribe-now-btn">${t('subscribe_now')}</button>
        </div>

        <div class="card" style="margin-top:24px;">
          <div class="card-header">
            <div class="card-title">Why Choose Our Managed Account?</div>
          </div>
          <div class="card-body">
            <div class="grid-3" style="gap:20px;">
              <div class="stagger-item" style="text-align:center;padding:20px;">
                <div style="font-size:36px;margin-bottom:12px;animation:float 3s ease-in-out infinite;">📈</div>
                <h4 style="font-size:15px;font-weight:700;margin-bottom:8px;color:#0f172a;">Expert Trading</h4>
                <p style="font-size:13px;color:#64748b;line-height:1.6;">Professional traders with years of experience manage your portfolio for maximum returns.</p>
              </div>
              <div class="stagger-item" style="text-align:center;padding:20px;">
                <div style="font-size:36px;margin-bottom:12px;animation:float 3s ease-in-out infinite 0.5s;">🛡️</div>
                <h4 style="font-size:15px;font-weight:700;margin-bottom:8px;color:#0f172a;">Risk Management</h4>
                <p style="font-size:13px;color:#64748b;line-height:1.6;">Advanced risk management strategies to protect your capital while maximizing gains.</p>
              </div>
              <div class="stagger-item" style="text-align:center;padding:20px;">
                <div style="font-size:36px;margin-bottom:12px;animation:float 3s ease-in-out infinite 1s;">📊</div>
                <h4 style="font-size:15px;font-weight:700;margin-bottom:8px;color:#0f172a;">Regular Reports</h4>
                <p style="font-size:13px;color:#64748b;line-height:1.6;">Receive detailed performance reports and transparent insights into your account activity.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('subscribe-now-btn').addEventListener('click', () => navigate('/managed-account/subscribe'));
  } else {
    // Show subscription status
    const plan = subscription;
    container.innerHTML = `
      <div class="page-inner">
        <div class="page-header">
          <div>
            <h1 class="page-title">${t('managed_account')}</h1>
            <p class="page-subtitle">${t('subscription_status')}</p>
          </div>
        </div>

        <div class="sub-status-card stagger-item">
          <div class="sub-status-badge">
            <span class="sub-status-dot"></span>
            ${plan.status === 'active' ? t('subscription_active') : plan.status}
          </div>
          <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:6px;">${plan.plan_name || 'Managed Account Plan'}</h2>
          <p style="font-size:13px;color:#64748b;">${t('managed_account_contact')}</p>

          <div class="sub-info-grid">
            <div class="sub-info-item">
              <div class="sub-info-label">Plan</div>
              <div class="sub-info-value">${plan.plan_name || '—'}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">Monthly Fee</div>
              <div class="sub-info-value">${formatCurrency(plan.plan_price || 0)}</div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">Status</div>
              <div class="sub-info-value" style="color:${plan.status === 'active' ? '#22c55e' : '#f59e0b'};">
                ${plan.status === 'active' ? '🟢 Active' : '⏳ ' + plan.status}
              </div>
            </div>
            <div class="sub-info-item">
              <div class="sub-info-label">Subscribed Since</div>
              <div class="sub-info-value">${new Date(plan.subscribed_at || plan.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          ${plan.admin_notes ? `
            <div style="margin-top:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:6px;">Manager Notes</div>
              <p style="font-size:13px;color:#0f172a;line-height:1.6;">${plan.admin_notes}</p>
            </div>
          ` : ''}

          <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
            <button class="btn btn-ghost" id="cancel-sub-btn" style="font-size:12px;">
              Cancel Subscription
            </button>
            <a href="mailto:support@finpay.com" class="btn btn-primary" style="font-size:12px;">
              📧 Contact Manager
            </a>
          </div>
        </div>

        <div class="card" style="margin-top:24px;">
          <div class="card-header">
            <div class="card-title">Account Information</div>
          </div>
          <div class="card-body">
            <div class="drawer-item">
              <span>Account Balance</span>
              <strong style="color:#22c55e;">${formatCurrency(currentUser.balance)}</strong>
            </div>
            <div class="drawer-item">
              <span>Account Holder</span>
              <strong>${currentUser.name}</strong>
            </div>
            <div class="drawer-item">
              <span>Support Email</span>
              <strong><a href="mailto:support@finpay.com" style="color:#22c55e;">support@finpay.com</a></strong>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cancel-sub-btn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to cancel your managed account subscription?')) return;
      try {
        await api.cancelManagedAccount();
        toast('Subscription cancelled.', 'success');
        render(container);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
}
