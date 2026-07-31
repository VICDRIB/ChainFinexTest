import api from '../api.js';
import { toast } from '../app.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Pending Deposits</h1>
          <p class="page-subtitle">Review and approve user crypto deposit submissions.</p>
        </div>
      </div>
      <div id="payments-list">
        <div class="loading-spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div class="modal-overlay" id="reject-modal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">Reject Deposit</span>
          <button class="modal-close" id="reject-modal-close">✕</button>
        </div>
        <p style="font-size:14px;color:#64748b;margin-bottom:16px;">Please provide a reason for rejecting this deposit. The user will be notified.</p>
        <div class="form-row">
          <label class="input-label">Rejection Reason</label>
          <textarea id="reject-reason" class="input-field" rows="3" placeholder="e.g. Payment not received, wrong network..."></textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn btn-danger btn-w100" id="confirm-reject-btn">Reject Deposit</button>
          <button class="btn btn-w100" id="cancel-reject-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  let pendingRejectId = null;

  document.getElementById('reject-modal-close').onclick = closeModal;
  document.getElementById('cancel-reject-btn').onclick = closeModal;
  document.getElementById('reject-modal').addEventListener('click', e => {
    if (e.target.id === 'reject-modal') closeModal();
  });

  function closeModal() {
    document.getElementById('reject-modal').classList.remove('open');
    pendingRejectId = null;
    document.getElementById('reject-reason').value = '';
  }

  document.getElementById('confirm-reject-btn').onclick = async () => {
    if (!pendingRejectId) return;
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { toast('Please enter a reason', 'error'); return; }

    const btn = document.getElementById('confirm-reject-btn');
    btn.disabled = true;
    btn.textContent = 'Rejecting...';

    try {
      await api.rejectPendingPayment(pendingRejectId, reason);
      toast('Deposit rejected', 'success');
      closeModal();
      load();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Reject Deposit';
    }
  };

  async function load() {
    const list = document.getElementById('payments-list');
    if (!list) return;
    try {
      const payments = await api.adminPendingPayments();

      if (!payments.length) {
        list.innerHTML = `
          <div class="card card-body" style="text-align:center;padding:48px;">
            <div style="font-size:36px;margin-bottom:12px;">✓</div>
            <p style="color:#64748b;">No pending deposits. All caught up!</p>
          </div>
        `;
        return;
      }

      list.innerHTML = payments.map(p => `
        <div class="card card-body" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">${p.users.name}</div>
              <div style="font-size:13px;color:#64748b;">📧 ${p.users.email}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">🕐 ${new Date(p.created_at).toLocaleString()}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:24px;font-weight:700;color:#22c55e;">+$${Number(p.amount).toFixed(2)}</div>
              <div style="font-size:13px;color:#64748b;">${p.method.toUpperCase()}</div>
              <span style="font-size:12px;font-weight:600;color:#f59e0b;background:#fffbeb;padding:2px 8px;border-radius:12px;">⏳ Awaiting Verification</span>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary approve-btn" data-id="${p.id}" style="flex:1;">✓ Approve Deposit</button>
            <button class="btn btn-danger reject-btn" data-id="${p.id}" style="flex:1;">✗ Reject</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Approving...';
          try {
            await api.approvePendingPayment(btn.dataset.id);
            toast('Deposit approved successfully', 'success');
            load();
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = '✓ Approve Deposit';
          }
        });
      });

      list.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingRejectId = btn.dataset.id;
          document.getElementById('reject-modal').classList.add('open');
          document.getElementById('reject-reason').focus();
        });
      });

    } catch (err) {
      list.innerHTML = `<div style="color:#ef4444;padding:20px;">${err.message}</div>`;
    }
  }

  load();
}
