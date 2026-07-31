import api from '../api.js';
import { formatCurrency, toast, navigate } from '../app.js';
import { t } from '../translations.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Transaction History</h1>
          <p class="page-subtitle">All deposits, investments, profits, swaps and withdrawals.</p>
        </div>
      </div>
      <div id="transactionSummary"></div>
      <div class="card" style="margin-top:24px;">
        <div class="card-header">
          <div class="card-title">Transactions</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input id="transactionSearch" class="input-field" placeholder="${t('search')}" style="width:180px;">
            <select id="transactionFilter" class="input-field" style="width:150px;">
              <option value="all">All</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="investment">Investments</option>
              <option value="profit">Profits</option>
              <option value="swap">Swaps</option>
              <option value="bonus">Bonus</option>
              <option value="referral_bonus">Referral</option>
            </select>
          </div>
        </div>

        <!-- PDF Download Bar -->
        <div style="padding:14px 20px 0;">
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
              <input type="date" id="pdf-from" class="input-field" style="width:140px;">
              <span style="font-size:12px;color:#64748b;">${t('to_date')}:</span>
              <input type="date" id="pdf-to" class="input-field" style="width:140px;">
            </span>
            <button class="btn btn-primary btn-sm" id="download-pdf-btn">
              ⬇ ${t('download')}
            </button>
          </div>
        </div>

        <div id="transactionTable" class="card-body">Loading...</div>
      </div>
    </div>
  `;

  let allTransactions = [];

  try {
    allTransactions = await api.myTransactions();
    renderSummary(allTransactions);
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderTable(allTransactions);

    document.getElementById('transactionSearch').oninput = () => filterTransactions(allTransactions);
    document.getElementById('transactionFilter').onchange = () => filterTransactions(allTransactions);

    // PDF range toggle
    document.getElementById('pdf-range').addEventListener('change', function() {
      const custom = document.getElementById('custom-dates');
      custom.style.display = this.value === 'custom' ? 'flex' : 'none';
    });

    // PDF download
    document.getElementById('download-pdf-btn').addEventListener('click', () => {
      downloadPDF(allTransactions);
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function getFilteredByDateRange(transactions) {
  const range = document.getElementById('pdf-range')?.value || 'all';
  if (range === 'all') return transactions;

  const now = new Date();
  let from, to;

  if (range === 'custom') {
    const fromVal = document.getElementById('pdf-from')?.value;
    const toVal   = document.getElementById('pdf-to')?.value;
    if (!fromVal || !toVal) { toast('Please select from and to dates.', 'error'); return null; }
    from = new Date(fromVal);
    to   = new Date(toVal);
    to.setHours(23, 59, 59, 999);
  } else {
    const days = parseInt(range);
    to = new Date(now);
    from = new Date(now);
    from.setDate(from.getDate() - days);
  }
  return transactions.filter(t => {
    const d = new Date(t.created_at);
    return d >= from && d <= to;
  });
}

function downloadPDF(transactions) {
  const filtered = getFilteredByDateRange(transactions);
  if (!filtered) return;
  if (!filtered.length) { toast('No transactions in the selected date range.', 'error'); return; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(74, 222, 128);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ChainFinex', 14, 14);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Transaction History Report', 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    // Range label
    const range = document.getElementById('pdf-range')?.value || 'all';
    let rangeLabel = 'All Time';
    if (range === '7') rangeLabel = 'Last 7 Days';
    else if (range === '30') rangeLabel = 'Last 30 Days';
    else if (range === '90') rangeLabel = 'Last 90 Days';
    else if (range === 'custom') {
      rangeLabel = `${document.getElementById('pdf-from')?.value} to ${document.getElementById('pdf-to')?.value}`;
    }
    doc.setTextColor(148, 163, 184);
    doc.text(`Period: ${rangeLabel}`, 130, 28);

    // Summary
    let deposits = 0, withdrawals = 0, investments = 0, profits = 0;
    filtered.forEach(tx => {
      const a = Number(tx.amount || 0);
      if (tx.type === 'deposit')    deposits    += a;
      if (tx.type === 'withdrawal') withdrawals += a;
      if (tx.type === 'investment') investments += a;
      if (tx.type === 'profit')     profits     += a;
    });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, 42);

    const summaryData = [
      ['Total Deposited', `$${deposits.toFixed(2)}`],
      ['Total Withdrawn', `$${withdrawals.toFixed(2)}`],
      ['Total Invested', `$${investments.toFixed(2)}`],
      ['Total Profit', `$${profits.toFixed(2)}`],
      ['Transactions', String(filtered.length)],
    ];

    doc.autoTable({
      startY: 46,
      head: [['Metric', 'Amount']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
      columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    // Transaction table
    const tableY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Transactions', 14, tableY);

    const rows = filtered.map(tx => [
      new Date(tx.created_at).toLocaleDateString(),
      (tx.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      tx.description || '—',
      tx.status || '—',
      `$${Number(tx.amount || 0).toFixed(2)}`,
    ]);

    doc.autoTable({
      startY: tableY + 4,
      head: [['Date', 'Type', 'Description', 'Status', 'Amount']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [11, 17, 32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      columnStyles: { 4: { fontStyle: 'bold', halign: 'right' } },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const status = (data.cell.raw || '').toLowerCase();
          if (status === 'completed') data.cell.styles.textColor = [22, 163, 74];
          else if (status === 'pending') data.cell.styles.textColor = [245, 158, 11];
          else if (status === 'failed') data.cell.styles.textColor = [239, 68, 68];
        }
      },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('All Rights Reserved © ChainFinex 2026', 14, 290);
      doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
    }

    doc.save(`ChainFinex-transactions-${Date.now()}.pdf`);
    toast('PDF downloaded successfully!', 'success');
  } catch (err) {
    toast('Failed to generate PDF: ' + err.message, 'error');
  }
}

function renderSummary(transactions) {
  let deposits = 0, withdrawals = 0, investments = 0, profits = 0;
  transactions.forEach(t => {
    const amount = Number(t.amount || 0);
    switch (t.type) {
      case 'deposit':    deposits    += amount; break;
      case 'withdrawal': withdrawals += amount; break;
      case 'investment': investments += amount; break;
      case 'profit':     profits     += amount; break;
    }
  });
  document.getElementById('transactionSummary').innerHTML = `
    <div class="grid-4">
      <div class="card stat-card stagger-item">
        <div class="stat-label">💳 Total Deposited</div>
        <div class="stat-value" style="color:#22c55e;">${formatCurrency(deposits)}</div>
      </div>
      <div class="card stat-card stagger-item">
        <div class="stat-label">💸 Total Withdrawn</div>
        <div class="stat-value" style="color:#ef4444;">${formatCurrency(withdrawals)}</div>
      </div>
      <div class="card stat-card stagger-item">
        <div class="stat-label">📦 Total Invested</div>
        <div class="stat-value" style="color:#3b82f6;">${formatCurrency(investments)}</div>
      </div>
      <div class="card stat-card stagger-item">
        <div class="stat-label">📈 Total Profit</div>
        <div class="stat-value" style="color:#8b5cf6;">${formatCurrency(profits)}</div>
      </div>
    </div>
  `;
}

function filterTransactions(transactions) {
  const search = document.getElementById('transactionSearch').value.toLowerCase();
  const filter = document.getElementById('transactionFilter').value;
  const filtered = transactions.filter(t => {
    const matchType = filter === 'all' || t.type === filter;
    const matchSearch = !search ||
      (t.description || '').toLowerCase().includes(search) ||
      (t.type || '').toLowerCase().includes(search) ||
      String(t.amount).includes(search);
    return matchType && matchSearch;
  });
  renderTable(filtered);
}

function renderTable(transactions) {
  const el = document.getElementById('transactionTable');
  if (!el) return;

  if (!transactions.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3 class="empty-title">No transactions found</h3><p class="empty-desc">No transactions match your current filters.</p></div>`;
    return;
  }

  const typeStyles = {
    deposit:       { color: '#22c55e', bg: '#f0fdf4', label: '💳 Deposit' },
    withdrawal:    { color: '#ef4444', bg: '#fef2f2', label: '💸 Withdrawal' },
    investment:    { color: '#3b82f6', bg: '#eff6ff', label: '📦 Investment' },
    profit:        { color: '#8b5cf6', bg: '#f5f3ff', label: '📈 Profit' },
    swap:          { color: '#f59e0b', bg: '#fffbeb', label: '🔄 Swap' },
    referral_bonus:{ color: '#14b8a6', bg: '#f0fdfa', label: '🎁 Referral' },
    referral_reward:{ color: '#14b8a6', bg: '#f0fdfa', label: '🎁 Referral' },
    bonus:         { color: '#6366f1', bg: '#eef2ff', label: '🎉 Bonus' },
    welcome_bonus: { color: '#6366f1', bg: '#eef2ff', label: '🎉 Bonus' },
  };

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Status</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(tx => {
            const style = typeStyles[tx.type] || { color: '#64748b', bg: '#f8fafc', label: tx.type };
            const isNeg = tx.type === 'withdrawal' || tx.type === 'investment';
            const statusColors = {
              completed: '#22c55e',
              pending:   '#f59e0b',
              failed:    '#ef4444',
              Received:  '#22c55e',
            };
            return `
              <tr>
                <td style="color:#64748b;font-size:12px;white-space:nowrap;">${new Date(tx.created_at).toLocaleDateString()} <span style="color:#94a3b8;">${new Date(tx.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></td>
                <td>
                  <span style="background:${style.bg};color:${style.color};font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;">
                    ${style.label}
                  </span>
                </td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tx.description || '—'}</td>
                <td>
                  <span style="font-size:11px;font-weight:600;color:${statusColors[tx.status] || '#64748b'};">
                    ${tx.status || '—'}
                  </span>
                </td>
                <td style="text-align:right;font-weight:700;color:${isNeg ? '#ef4444' : '#22c55e'};">
                  ${isNeg ? '-' : '+'}${formatCurrency(tx.amount)}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
