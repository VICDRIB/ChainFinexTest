import api from '../api.js';
import { formatCurrency, toast } from '../app.js';
import { t } from '../translations.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">${t('manage_accounts')}</h1>
          <p class="page-subtitle">View and manage all user managed account subscriptions.</p>
        </div>
        <span class="user-count-badge" id="sub-count"></span>
      </div>

      <div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">
        <input id="sub-search" class="input-field" placeholder="Search by name or email..." style="max-width:320px;">
        <select id="sub-status-filter" class="input-field" style="width:160px;">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div id="subscriptions-list"></div>
    </div>

    <!-- Notes Modal -->
    <div class="modal-overlay" id="notes-modal">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title" id="notes-modal-title">Update Notes</span>
          <button class="modal-close" id="notes-modal-close">✕</button>
        </div>
        <div style="padding:18px 20px;">
          <div class="form-row">
            <label class="input-label">Status</label>
            <select id="notes-status" class="input-field">
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="form-row">
            <label class="input-label">Manager Notes</label>
            <textarea id="notes-text" class="input-field" rows="4" placeholder="Add notes about this account's progress, performance, or any updates..." style="resize:vertical;"></textarea>
          </div>
          <button class="btn btn-primary btn-w100" id="notes-save-btn" style="margin-top:4px;">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  let allSubs = [];
  let editingId = null;

  // Modal handlers
  document.getElementById('notes-modal-close').addEventListener('click', () => {
    document.getElementById('notes-modal').classList.remove('open');
  });
  document.getElementById('notes-modal').addEventListener('click', e => {
    if (e.target.id === 'notes-modal') document.getElementById('notes-modal').classList.remove('open');
  });

  document.getElementById('notes-save-btn').addEventListener('click', async () => {
    if (!editingId) return;
    const btn = document.getElementById('notes-save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await api.adminUpdateManagedAccount(editingId, {
        status: document.getElementById('notes-status').value,
        admin_notes: document.getElementById('notes-text').value.trim(),
      });
      document.getElementById('notes-modal').classList.remove('open');
      toast('Account updated successfully.', 'success');
      await loadSubs();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });

  window._openNotesModal = (id, name, status, notes) => {
    editingId = id;
    document.getElementById('notes-modal-title').textContent = `Manage — ${name}`;
    document.getElementById('notes-status').value = status || 'active';
    document.getElementById('notes-text').value = notes || '';
    document.getElementById('notes-modal').classList.add('open');
  };

  // Search / filter
  document.getElementById('sub-search').addEventListener('input', () => renderFiltered());
  document.getElementById('sub-status-filter').addEventListener('change', () => renderFiltered());

  function renderFiltered() {
    const search = document.getElementById('sub-search').value.toLowerCase();
    const statusFilter = document.getElementById('sub-status-filter').value;
    const filtered = allSubs.filter(s => {
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const name = (s.users?.name || '').toLowerCase();
      const email = (s.users?.email || '').toLowerCase();
      const matchSearch = !search || name.includes(search) || email.includes(search);
      return matchStatus && matchSearch;
    });
    renderList(filtered);
  }

  function renderList(subs) {
    const list = document.getElementById('subscriptions-list');
    if (!list) return;

    const countEl = document.getElementById('sub-count');
    if (countEl) countEl.textContent = `${subs.length} subscription${subs.length !== 1 ? 's' : ''}`;

    if (!subs.length) {
      list.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">🏦</div>
            <h3 class="empty-title">No subscriptions found</h3>
            <p class="empty-desc">No managed account subscriptions match your filters.</p>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Managed Account Subscriptions</div>
        </div>
        ${subs.map((sub, i) => {
          const statusColors = {
            active:    { color: '#22c55e', bg: '#f0fdf4', label: '🟢 Active' },
            pending:   { color: '#f59e0b', bg: '#fffbeb', label: '⏳ Pending' },
            cancelled: { color: '#ef4444', bg: '#fef2f2', label: '🔴 Cancelled' },
          };
          const sc = statusColors[sub.status] || statusColors.pending;
          const userName = sub.users?.name || 'Unknown';
          const userEmail = sub.users?.email || '';
          return `
            <div class="managed-user-card stagger-item">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
                  <div class="user-avatar-lg" style="background:${['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'][i % 5]};">
                    ${userName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div class="user-name-main">${userName}</div>
                    <div class="user-email-small">${userEmail}</div>
                    <div style="margin-top:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:999px;color:${sc.color};background:${sc.bg};">${sc.label}</span>
                      <span style="font-size:12px;color:#64748b;">${sub.plan_name || 'Plan'}</span>
                      <span style="font-size:12px;font-weight:700;color:#0f172a;">${formatCurrency(sub.plan_price || 0)}/mo</span>
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">
                      Subscribed: ${new Date(sub.subscribed_at || sub.created_at).toLocaleDateString()}
                    </div>
                    ${sub.admin_notes ? `
                      <div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#334155;line-height:1.5;">
                        <strong style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Notes:</strong><br>
                        ${sub.admin_notes}
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div style="flex-shrink:0;">
                  <button class="btn btn-primary btn-sm"
                    onclick="window._openNotesModal(${sub.id},'${userName.replace(/'/g,"\\'")}','${sub.status}','${(sub.admin_notes||'').replace(/'/g,"\\'").replace(/\n/g,'\\n')}')">
                    ✏️ Manage
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadSubs() {
    try {
      allSubs = await api.adminManagedAccounts();
      renderFiltered();
    } catch (err) {
      document.getElementById('subscriptions-list').innerHTML = `
        <div class="card card-body" style="color:#ef4444;text-align:center;">${err.message}</div>
      `;
    }
  }

  await loadSubs();
}
