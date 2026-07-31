import api from '../api.js';
import { formatCurrency, toast, navigate } from '../app.js';
import { t } from '../translations.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Deposit History</h1>
          <p class="page-subtitle">All your submitted deposits and their statuses.</p>
        </div>
      </div>

      <!-- PDF Download Bar -->
      <div class="pdf-download-bar">
        <span class="pdf-label">📄 ${t('download_pdf')}</span>
        <select id="pdf-range" class="input-field" style="width:160px;">
          <option value="all">${t('all_time')}</option>
          <option value="7">${t('last_7_days')}</option>
          <option value="30">${t('last_30_days')}</option>
          <option value="90">${t('last_90_days')}</option>
          <option value="custom">${t('custom_range')}</option>
        </select>
        <span id="custom-dates" style="display:none;gap:8px;align-items:center;" class="flex">
          <span style="font-size:12px;color:#64748b;">${t('from_date')}:</span>
          <input type="date" id="pdf-from">
          <span style="font-size:12px;color:#64748b;">${t('to_date')}:</span>
          <input type="date" id="pdf-to">
        </span>
        <button class="btn btn-primary btn-sm" id="download-pdf-btn">⬇ ${t('download')}</button>
      </div>

      <div id="depositList"></div>
    </div>
  `;

  document.getElementById('pdf-range').addEventListener('change', function() {
    document.getElementById('custom-dates').style.display = this.value === 'custom' ? 'flex' : 'none';
  });

  let deposits = [];
  try {
    deposits = await api.myDeposits();
    renderDeposits(deposits);

    document.getElementById('download-pdf-btn').addEventListener('click', () => downloadPDF(deposits));
  } catch (err) {
    document.getElementById('depositList').innerHTML = `<div class="card card-body" style="color:#ef4444;">${err.message}</div>`;
  }
}

function getFiltered(deposits) {
  const range = document.getElementById('pdf-range')?.value || 'all';
  if (range === 'all') return deposits;
  const now = new Date();
  let from, to;
  if (range === 'custom') {
    const fv = document.getElementById('pdf-from')?.value;
    const tv = document.getElementById('pdf-to')?.value;
    if (!fv || !tv) { toast('Please select from and to dates.', 'error'); return null; }
    from = new Date(fv); to = new Date(tv); to.setHours(23,59,59,999);
  } else {
    to = new Date(now); from = new Date(now); from.setDate(from.getDate() - parseInt(range));
  }
  return deposits.filter(d => { const dd = new Date(d.created_at || d.submitted_at); return dd >= from && dd <= to; });
}

function downloadPDF(deposits) {
  const filtered = getFiltered(deposits);
  if (!filtered) return;
  if (!filtered.length) { toast('No deposits in selected date range.', 'error'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(11,17,32); doc.rect(0,0,210,28,'F');
    doc.setTextColor(74,222,128); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('ChainFinex', 14, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Deposit History Report', 14, 20);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const rows = filtered.map(d => [
      new Date(d.created_at || d.submitted_at).toLocaleDateString(),
      (d.method || '').toUpperCase(),
      `$${Number(d.amount).toFixed(2)}`,
      d.status || '—',
    ]);
    doc.autoTable({
      startY: 34, head: [['Date','Method','Amount','Status']],
      body: rows, theme: 'striped',
      headStyles: { fillColor: [11,17,32], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148,163,184);
      doc.text('All Rights Reserved © ChainFinex 2026', 14, 290);
      doc.text(`Page ${i} of ${pages}`, 190, 290, { align: 'right' });
    }
    doc.save(`ChainFinex-deposits-${Date.now()}.pdf`);
    toast('PDF downloaded!', 'success');
  } catch(err) { toast('Failed to generate PDF: '+err.message, 'error'); }
}

function renderDeposits(deposits) {
  const list = document.getElementById('depositList');
  if (!deposits.length) {

    list.innerHTML = `
      <div class="card">
  
        <div class="empty-state">
  
          <div class="empty-icon">
            💳
          </div>
  
          <h3 class="empty-title">
            No deposits yet
          </h3>
  
          <p class="empty-desc">
            You haven't made your first deposit yet.
            Click the button below to make your first deposit.
          </p>
  
          <br>
  
          <button
            id="makeFirstDeposit"
            class="btn btn-primary">
  
            Make Your First Deposit
  
          </button>
  
        </div>
  
      </div>
    `;
  
    document
      .getElementById("makeFirstDeposit")
      .onclick = () => {

        navigate("/payments");

      };
  
    return;
  
  }
  const total = deposits.filter(d => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);
  const pending = deposits.filter(d => d.status === 'awaiting_verification').length;
  list.innerHTML = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="card stat-card stagger-item"><div class="stat-label">💳 Total Deposited</div><div class="stat-value" style="color:#22c55e;">${formatCurrency(total)}</div></div>
      <div class="card stat-card stagger-item"><div class="stat-label">📦 Total Deposits</div><div class="stat-value">${deposits.length}</div></div>
      <div class="card stat-card stagger-item"><div class="stat-label">⏳ Pending</div><div class="stat-value" style="color:#f59e0b;">${pending}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">All Deposits</div></div>
      ${deposits.map(d => {
        const sc = {
          approved:              { color:'#22c55e', bg:'#f0fdf4', label:'✓ Approved' },
          awaiting_verification: { color:'#f59e0b', bg:'#fffbeb', label:'⏳ Pending' },
          rejected:              { color:'#ef4444', bg:'#fef2f2', label:'✗ Rejected' },
        }[d.status] || { color:'#64748b', bg:'#f8fafc', label: d.status };
        return `
          <div class="payment-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <strong>${(d.method||'').toUpperCase()} Deposit</strong>
                  <span style="font-size:11px;font-weight:600;color:${sc.color};background:${sc.bg};padding:2px 9px;border-radius:999px;">${sc.label}</span>
                </div>
                <div style="font-size:12px;color:#94a3b8;">${new Date(d.created_at||d.submitted_at).toLocaleString()}</div>
                ${d.reject_reason ? `<div style="font-size:12px;color:#ef4444;margin-top:6px;padding:6px 10px;background:#fef2f2;border-radius:6px;"><strong>Reason:</strong> ${d.reject_reason}</div>` : ''}
              </div>
              <div style="font-size:22px;font-weight:800;color:#22c55e;">+${formatCurrency(d.amount)}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}
