import api from '../api.js';
import { formatCurrency, toast } from '../app.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Withdrawal Management</h1>
          <p class="page-subtitle">Approve or decline user withdrawal requests.</p>
        </div>
      </div>
      <div id="withdrawal-filter" style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <button class="btn btn-primary filter-btn active" data-filter="pending">Pending</button>
        <button class="btn filter-btn" data-filter="approved">Approved</button>
        <button class="btn filter-btn" data-filter="declined">Declined</button>
        <button class="btn filter-btn" data-filter="all">All</button>
      </div>
      <div id="withdrawals-list">
        <div class="loading-spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Decline Modal -->
    <div class="modal-overlay" id="decline-modal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">Decline Withdrawal</span>
          <button class="modal-close" id="decline-modal-close">✕</button>
        </div>
        <p style="font-size:14px;color:#64748b;margin-bottom:16px;">Please provide a reason for declining this withdrawal. The user will be notified.</p>
        <div class="form-row">
          <label class="input-label">Decline Reason</label>
          <textarea id="decline-reason" class="input-field" rows="3" placeholder="e.g. Invalid wallet address, suspicious activity..."></textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn btn-danger btn-w100" id="confirm-decline-btn">Decline Withdrawal</button>
          <button class="btn btn-w100" id="cancel-decline-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  let allWithdrawals = [];
  let currentFilter = 'pending';
  let pendingDeclineId = null;

  // Modal events
  document.getElementById('decline-modal-close').onclick = closeModal;
  document.getElementById('cancel-decline-btn').onclick = closeModal;
  document.getElementById('decline-modal').addEventListener('click', e => {
    if (e.target.id === 'decline-modal') closeModal();
  });

  function closeModal() {
    document.getElementById('decline-modal').classList.remove('open');
    pendingDeclineId = null;
    document.getElementById('decline-reason').value = '';
  }

  document.getElementById('confirm-decline-btn').onclick = async () => {
    if (!pendingDeclineId) return;
    const reason = document.getElementById('decline-reason').value.trim();
    if (!reason) { toast('Please enter a reason', 'error'); return; }

    const btn = document.getElementById('confirm-decline-btn');
    btn.disabled = true;
    btn.textContent = 'Declining...';

    try {
      await api.rejectWithdrawal(pendingDeclineId, reason);
      toast('Withdrawal declined', 'success');
      closeModal();
      await load();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Decline Withdrawal';
    }
  };

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      btn.classList.add('active', 'btn-primary');
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });

  async function load() {
    try {
      allWithdrawals = await api.adminWithdrawals();
      renderList();
    } catch (err) {
      document.getElementById('withdrawals-list').innerHTML = `<div style="color:#ef4444;padding:20px;">${err.message}</div>`;
    }
  }

  function renderList() {
    const list = document.getElementById('withdrawals-list');
    const filtered = currentFilter === 'all' ? allWithdrawals : allWithdrawals.filter(w => w.status === currentFilter);

    if (!filtered.length) {
      list.innerHTML = `
        <div class="card card-body" style="text-align:center;padding:48px;">
          <div style="font-size:36px;margin-bottom:12px;">💸</div>
          <p style="color:#64748b;">No ${currentFilter === 'all' ? '' : currentFilter} withdrawals found.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(w => {
      const statusBadge = {
        pending: '<span class="status-badge pending">⏳ Pending Approval</span>',
        approved: '<span class="status-badge approved">✓ Completed</span>',
        declined: '<span class="status-badge declined">✗ Declined</span>',
      }[w.status] || `<span class="status-badge">${w.status}</span>`;

      const actions = w.status === 'pending' ? `
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn btn-primary approve-w-btn" data-id="${w.id}">✓ Approve</button>
          <button class="btn btn-danger decline-w-btn" data-id="${w.id}">✗ Decline</button>
        </div>
      ` : '';

      return `
        <div class="card card-body withdrawal-card" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <strong style="font-size:16px;">${w.users?.name || 'Unknown'}</strong>
                ${statusBadge}
              </div>
              <div style="font-size:13px;color:#64748b;margin-bottom:4px;">📧 ${w.users?.email || ''}</div>
              <div style="font-size:13px;color:#64748b;">🕐 ${new Date(w.created_at).toLocaleString()}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:24px;font-weight:700;color:#ef4444;">$${Number(w.amount).toFixed(2)}</div>
              <div style="font-size:13px;color:#64748b;">${w.currency?.toUpperCase()} Withdrawal</div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-top:12px;">
            <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Destination Wallet</div>
            <div class="mono" style="font-size:12px;word-break:break-all;color:#0f172a;">${w.wallet_address}</div>
          </div>

          ${w.decline_reason ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-top:8px;">
              <div style="font-size:12px;color:#ef4444;font-weight:600;">Decline Reason</div>
              <div style="font-size:13px;color:#7f1d1d;margin-top:4px;">${w.decline_reason}</div>
            </div>
          ` : ''}

          ${actions}
        </div>
      `;
    }).join('');

    // Approve buttons
    list.querySelectorAll('.approve-w-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Approving...';
        try {
          await api.approveWithdrawal(btn.dataset.id);
          toast('Withdrawal approved', 'success');
          await load();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '✓ Approve';
        }
      });
    });

    // Decline buttons — open modal
    list.querySelectorAll('.decline-w-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingDeclineId = btn.dataset.id;
        document.getElementById('decline-modal').classList.add('open');
        document.getElementById('decline-reason').focus();
      });
    });
  }

  await load();
}
