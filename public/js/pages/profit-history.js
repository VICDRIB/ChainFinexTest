import api from '../api.js';
import { formatCurrency, navigate, toast } from '../app.js';
import { t } from '../translations.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
          <h1 class="page-title" style="margin-top:10px;">Profit History</h1>
          <p class="page-subtitle">Every profit credited to your account.</p>
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

      <div id="profit-content"></div>
    </div>
  `;

  document.getElementById('pdf-range').addEventListener('change', function() {
    document.getElementById('custom-dates').style.display = this.value === 'custom' ? 'flex' : 'none';
  });

  let profits = [];
  try {
    const transactions = await api.myTransactions();
    profits = transactions.filter(t => t.type === 'profit').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderProfits(profits);
    document.getElementById('download-pdf-btn').addEventListener('click', () => downloadPDF(profits));
  } catch (err) {
    document.getElementById('profit-content').innerHTML = `<div class="card card-body" style="color:#ef4444;">${err.message}</div>`;
  }
}

function getFiltered(items) {
  const range = document.getElementById('pdf-range')?.value || 'all';
  if (range === 'all') return items;
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
  return items.filter(p => { const d = new Date(p.created_at); return d >= from && d <= to; });
}

function downloadPDF(profits) {
  const filtered = getFiltered(profits);
  if (!filtered) return;
  if (!filtered.length) { toast('No profits in selected date range.', 'error'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(11,17,32); doc.rect(0,0,210,28,'F');
    doc.setTextColor(74,222,128); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('ChainFinex', 14, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Profit History Report', 14, 20);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    const total = filtered.reduce((s, p) => s + Number(p.amount), 0);
    doc.setTextColor(15,23,42); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('Summary', 14, 36);
    doc.autoTable({
      startY: 40,
      head: [['Metric','Value']],
      body: [
        ['Total Profit', `$${total.toFixed(2)}`],
        ['Transactions', String(filtered.length)],
        ['Average Profit', `$${(total / filtered.length).toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22,163,74], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    const rows = filtered.map(p => [
      new Date(p.created_at).toLocaleDateString(),
      p.description || 'Profit',
      `$${Number(p.amount).toFixed(2)}`,
      p.status || 'completed',
    ]);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Date','Description','Amount','Status']],
      body: rows, theme: 'striped',
      headStyles: { fillColor: [11,17,32], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [51,65,85] },
      columnStyles: { 2: { fontStyle: 'bold', textColor: [22,163,74] } },
      margin: { left: 14, right: 14 },
    });
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148,163,184);
      doc.text('All Rights Reserved © ChainFinex 2026', 14, 290);
      doc.text(`Page ${i} of ${pages}`, 190, 290, { align: 'right' });
    }
    doc.save(`ChainFinex-profits-${Date.now()}.pdf`);
    toast('PDF downloaded!', 'success');
  } catch(err) { toast('Failed to generate PDF: '+err.message, 'error'); }
}

function renderProfits(profits) {
  const el = document.getElementById('profit-content');
  if (!profits.length) {
    el.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">📈</div>
          <h3 class="empty-title">No profits yet</h3>
          <p class="empty-desc">Profits from your active investment plans will appear here.</p>
          <button class="btn btn-primary" id="profitInvest">Browse Investment Plans</button>
        </div>
      </div>
    `;
    document.getElementById('profitInvest')?.addEventListener('click', () => navigate('/trading-plans'));
    return;
  }
  const total = profits.reduce((s, p) => s + Number(p.amount), 0);
  el.innerHTML = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="card stat-card stagger-item">
        <div class="stat-label">📈 Total Profit</div>
        <div class="stat-value" style="color:#22c55e;">${formatCurrency(total)}</div>
      </div>
      <div class="card stat-card stagger-item">
        <div class="stat-label">🔢 Payments</div>
        <div class="stat-value">${profits.length}</div>
      </div>
      <div class="card stat-card stagger-item">
        <div class="stat-label">📊 Avg Per Payment</div>
        <div class="stat-value" style="color:#8b5cf6;">${formatCurrency(total / profits.length)}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Profit Transactions</div>
      </div>
      <div class="card-body">
        ${profits.map(p => `
          <div class="profit-row">
            <div>
              <strong style="font-size:13px;">${p.description || 'Daily Profit'}</strong>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">${new Date(p.created_at).toLocaleString()}</div>
            </div>
            <strong style="color:#22c55e;font-size:16px;">+${formatCurrency(p.amount)}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
