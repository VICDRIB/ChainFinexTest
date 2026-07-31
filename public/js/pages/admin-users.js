import api from '../api.js';
import { toast, formatCurrency, navigate } from '../app.js';

const COLORS = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1'];

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">User Management</h1>
          <p class="page-subtitle">Manage accounts, balances and view user activity.</p>
        </div>
        <span class="user-count-badge" id="user-count"></span>
      </div>
      <div style="margin-bottom:16px;">
        <input id="user-search" class="input-field" placeholder="Search by name or email..." style="max-width:340px;">
      </div>
      <div id="users-list"></div>
    </div>

    <!-- User Activity Modal -->
    <div class="modal-overlay" id="user-activity-modal">
      <div class="modal" style="max-width:640px;max-height:80vh;overflow-y:auto;">
        <div class="modal-header">
          <span class="modal-title" id="activity-modal-title">User Activity</span>
          <button class="modal-close" id="activity-modal-close">✕</button>
        </div>
        <div id="activity-modal-body">
          <div class="loading-spinner-wrap"><div class="spinner"></div></div>
        </div>
      </div>
    </div>

    <!-- Set balance dialog -->
    <div class="modal-overlay" id="set-modal">
      <div class="modal" style="max-width:320px;">
        <div class="modal-header">
          <span class="modal-title" id="set-modal-title">Set Balance</span>
          <button class="modal-close" id="set-close">✕</button>
        </div>
        <div class="form-row" style="margin-top:4px;">
          <label class="input-label">New Balance (USD)</label>
          <input class="input-field" id="set-amount" type="number" min="0" step="0.01" />
        </div>
        <button class="btn btn-primary btn-w100" id="set-confirm" style="margin-top:8px;">Set Balance</button>
      </div>
    </div>
  `;

  let allUsers = [];
  let setTargetId = null;

  // Set balance modal
  document.getElementById('set-close').addEventListener('click', () => document.getElementById('set-modal').classList.remove('open'));
  document.getElementById('set-modal').addEventListener('click', e => { if (e.target.id === 'set-modal') document.getElementById('set-modal').classList.remove('open'); });
  document.getElementById('set-confirm').addEventListener('click', async () => {
    if (!setTargetId) return;
    const amount = parseFloat(document.getElementById('set-amount').value);
    if (isNaN(amount) || amount < 0) { toast('Enter a valid amount', 'error'); return; }
    await doBalance(setTargetId, 'set', amount);
    document.getElementById('set-modal').classList.remove('open');
  });

  // Activity modal
  document.getElementById('activity-modal-close').addEventListener('click', () => {
    document.getElementById('user-activity-modal').classList.remove('open');
  });
  document.getElementById('user-activity-modal').addEventListener('click', e => {
    if (e.target.id === 'user-activity-modal') document.getElementById('user-activity-modal').classList.remove('open');
  });

  window._openSetModal = (userId, currentBalance, name) => {
    setTargetId = userId;
    document.getElementById('set-modal-title').textContent = `Set Balance — ${name}`;
    document.getElementById('set-amount').value = currentBalance;
    document.getElementById('set-modal').classList.add('open');
    document.getElementById('set-amount').focus();
  };

  window._doInlineBalance = async (userId, action) => {
    const input = document.querySelector(`input[data-user="${userId}"][data-action="${action}"]`);
    if (!input) return;
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount < 0) { toast('Enter a valid amount', 'error'); return; }
    await doBalance(userId, action, amount);
    input.value = '';
    document.querySelectorAll('.balance-popover').forEach(p => p.remove());
  };

  window._viewUserActivity = async (userId, userName) => {
    document.getElementById('activity-modal-title').textContent = `Activity – ${userName}`;
    document.getElementById('activity-modal-body').innerHTML = `<div class="loading-spinner-wrap"><div class="spinner"></div></div>`;
    document.getElementById('user-activity-modal').classList.add('open');

    try {
      const data = await api.adminUserActivity(userId);
      const { activity, transactions, deposits, withdrawals } = data;

      const tabs = [
        { id: 'tab-activity', label: `Activity (${activity.length})`, content: renderActivityTab(activity) },
        { id: 'tab-transactions', label: `Transactions (${transactions.length})`, content: renderTransactionsTab(transactions) },
        { id: 'tab-deposits', label: `Deposits (${deposits.length})`, content: renderDepositsTab(deposits) },
        { id: 'tab-withdrawals', label: `Withdrawals (${withdrawals.length})`, content: renderWithdrawalsTab(withdrawals) },
      ];

      document.getElementById('activity-modal-body').innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;flex-wrap:wrap;">
          ${tabs.map((t, i) => `
            <button class="btn ${i === 0 ? 'btn-primary' : ''} modal-tab-btn" data-tab="${t.id}" style="font-size:12px;padding:6px 12px;">
              ${t.label}
            </button>
          `).join('')}
        </div>
        ${tabs.map(t => `<div id="${t.id}" class="modal-tab-content" style="${t.id !== 'tab-activity' ? 'display:none' : ''}">${t.content}</div>`).join('')}
      `;

      document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('btn-primary'));
          document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
          btn.classList.add('btn-primary');
          document.getElementById(btn.dataset.tab).style.display = '';
        });
      });
    } catch (err) {
      document.getElementById('activity-modal-body').innerHTML = `<div style="color:#ef4444;padding:16px;">${err.message}</div>`;
    }
  };

  function renderActivityTab(logs) {
    if (!logs.length) return `<div style="text-align:center;padding:32px;color:#94a3b8;">No activity recorded.</div>`;
    const typeIcon = { login: '🔑', signup: '✨', payment_awaiting_verification: '💸', withdrawal_requested: '🏦', withdrawal_approved: '✅', profile_updated: '👤', password_changed: '🔒', swap: '🔄', balance_increase: '📈', balance_decrease: '📉', balance_set: '💲' };
    return `<div style="display:flex;flex-direction:column;gap:0;">
      ${logs.map(l => {
        const meta = typeof l.metadata === 'object' ? l.metadata : {};
        const icon = typeIcon[l.type] || '•';
        return `<div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:10px;align-items:flex-start;">
          <span style="font-size:16px;width:24px;flex-shrink:0;">${icon}</span>
          <div>
            <div style="font-size:13px;color:#0f172a;font-weight:500;">${l.type.replace(/_/g,' ')}</div>
            ${meta.location ? `<div style="font-size:11px;color:#64748b;">📍 ${meta.location}</div>` : ''}
            ${meta.ip ? `<div class="mono" style="font-size:10px;color:#94a3b8;">${meta.ip}</div>` : ''}
            <div style="font-size:11px;color:#94a3b8;">${new Date(l.created_at).toLocaleString()}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderTransactionsTab(txs) {
    if (!txs.length) return `<div style="text-align:center;padding:32px;color:#94a3b8;">No transactions.</div>`;
    return `<div>${txs.map(t => `
      <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:500;">${t.type.replace(/_/g,' ')} – ${t.description || ''}</div>
          <div style="font-size:11px;color:#94a3b8;">${new Date(t.created_at).toLocaleString()}</div>
        </div>
        <div style="font-weight:700;font-size:14px;color:${t.type==='deposit'||t.type==='profit'?'#22c55e':'#ef4444'};">
          ${formatCurrency(t.amount)}
        </div>
      </div>
    `).join('')}</div>`;
  }

  function renderDepositsTab(deps) {
    if (!deps.length) return `<div style="text-align:center;padding:32px;color:#94a3b8;">No deposits.</div>`;
    return `<div>${deps.map(d => `
      <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:500;">${d.method?.toUpperCase()} Deposit</div>
          <div style="font-size:11px;color:#94a3b8;">${new Date(d.created_at).toLocaleString()}</div>
          ${d.reject_reason ? `<div style="font-size:11px;color:#ef4444;">Reason: ${d.reject_reason}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;font-size:14px;color:#22c55e;">+${formatCurrency(d.amount)}</div>
          <div style="font-size:11px;color:${d.status==='approved'?'#22c55e':d.status==='rejected'?'#ef4444':'#f59e0b'};">${d.status}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function renderWithdrawalsTab(wds) {
    if (!wds.length) return `<div style="text-align:center;padding:32px;color:#94a3b8;">No withdrawals.</div>`;
    return `<div>${wds.map(w => `
      <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:13px;font-weight:500;">${w.currency?.toUpperCase()} Withdrawal</div>
          <div class="mono" style="font-size:10px;color:#94a3b8;word-break:break-all;">${w.wallet_address}</div>
          <div style="font-size:11px;color:#94a3b8;">${new Date(w.created_at).toLocaleString()}</div>
          ${w.decline_reason ? `<div style="font-size:11px;color:#ef4444;">Reason: ${w.decline_reason}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px;">
          <div style="font-weight:700;font-size:14px;color:#ef4444;">-${formatCurrency(w.amount)}</div>
          <div style="font-size:11px;color:${w.status==='approved'?'#22c55e':w.status==='declined'?'#ef4444':'#f59e0b'};">${w.status}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }

  async function doBalance(userId, action, amount) {
    try {
      await api.patchBalance(userId, action, amount);
      toast(`Balance ${action === 'set' ? 'set to' : action === 'increase' ? 'increased by' : 'decreased by'} ${formatCurrency(amount)}`, 'success');
      await loadUsers();
    } catch (err) {
      toast(err.message || 'Failed to update balance', 'error');
    }
  }

  // Search
  document.getElementById('user-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    const rows = document.querySelectorAll('.user-row[data-name]');
    rows.forEach(row => {
      const name = row.dataset.name.toLowerCase();
      const email = row.dataset.email.toLowerCase();
      row.style.display = (!q || name.includes(q) || email.includes(q)) ? '' : 'none';
    });
  });

  async function loadUsers() {
    const list = document.getElementById('users-list');
    const countEl = document.getElementById('user-count');
    if (!list) return;
    try {
      allUsers = await api.adminUsers();
      if (countEl) countEl.textContent = `${allUsers.length} ${allUsers.length === 1 ? 'user' : 'users'}`;

      if (!allUsers.length) {
        list.innerHTML = `<div style="text-align:center;padding:64px 0;color:#94a3b8;">No users found.</div>`;
        return;
      }

      list.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
        ${allUsers.map((u, i) => {
          const color = COLORS[u.id % COLORS.length];
          const ini = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return `
            <div class="user-row stagger-item" style="overflow:visible;" data-name="${u.name}" data-email="${u.email}">
              <div class="user-avatar" style="background:${color};width:44px;height:44px;font-size:14px;flex-shrink:0;">${ini}</div>
              <div class="user-row-info">
                <div class="user-row-name">
                  ${u.name}
                  <span class="${u.role === 'admin' ? 'badge-admin-row' : 'badge-user-row'}">${u.role}</span>
                </div>
                <div class="user-row-email">${u.email}</div>
                ${u.country ? `<div style="font-size:11px;color:#94a3b8;">📍 ${u.country}</div>` : ''}
              </div>
              <div class="user-balance">
                <div class="user-balance-val" id="bal-${u.id}">${formatCurrency(u.balance)}</div>
                <div class="user-balance-lbl">Balance</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <div class="balance-controls" style="position:relative;">
                  <button class="balance-btn dec" title="Decrease" onclick="showBalancePopover(${u.id},'decrease',this)">−</button>
                  <button class="balance-btn inc" title="Increase" onclick="showBalancePopover(${u.id},'increase',this)">+</button>
                  <button class="balance-btn set" title="Set exact" onclick="window._openSetModal(${u.id},${u.balance},'${u.name.replace(/'/g,"\\'")}')"  >✎</button>
                </div>
                <button class="btn" style="font-size:11px;padding:6px 10px;" onclick="window._viewUserActivity(${u.id},'${u.name.replace(/'/g,"\\'")}')">👁 History</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>`;
    } catch (err) {
      if (list) list.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">${err.message}</div>`;
    }
  }

  await loadUsers();
}

window.showBalancePopover = (userId, action, btn) => {
  document.querySelectorAll('.balance-popover').forEach(p => p.remove());
  const label = action === 'decrease' ? 'Decrease by' : 'Increase by';
  const pop = document.createElement('div');
  pop.className = 'balance-popover';
  pop.style.cssText = 'position:absolute;bottom:calc(100% + 6px);right:0;';
  pop.innerHTML = `
    <div class="balance-popover-label">${label}</div>
    <div class="balance-popover-row">
      <input class="balance-popover-input" type="number" min="0" step="0.01" placeholder="0.00" data-user="${userId}" data-action="${action}" />
      <button class="btn btn-primary btn-sm" onclick="window._doInlineBalance(${userId},'${action}')">OK</button>
    </div>
  `;
  btn.parentElement.style.position = 'relative';
  btn.parentElement.appendChild(pop);
  pop.querySelector('input').focus();
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!pop.contains(e.target) && e.target !== btn) {
        pop.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 50);
};
