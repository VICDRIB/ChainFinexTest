import api from '../api.js';
import { timeAgo, navigate, toast } from '../app.js';
import { t } from '../translations.js';

const TYPE_CFG = {
  login:                    { icon: '🔑', label: (m) => `logged in from ${m?.location || 'unknown location'}` },
  signup:                   { icon: '✨', label: (m) => `created an account${m?.location ? ' from ' + m.location : ''}` },
  balance_increase:         { icon: '📈', label: (m) => `balance increased by $${parseFloat(m?.amount||0).toFixed(2)}${m?.adminName?' (by admin: '+m.adminName+')':''}` },
  balance_decrease:         { icon: '📉', label: (m) => `balance decreased by $${parseFloat(m?.amount||0).toFixed(2)}${m?.adminName?' (by admin: '+m.adminName+')':''}` },
  balance_set:              { icon: '💲', label: (m) => `balance set to $${parseFloat(m?.newBalance||0).toFixed(2)}${m?.adminName?' (by admin: '+m.adminName+')':''}` },
  payment_awaiting_verification: { icon: '💸', label: (m) => `submitted a $${m?.amount||0} deposit via ${m?.method||'unknown'}` },
  withdrawal_requested:     { icon: '🏦', label: (m) => `requested a $${parseFloat(m?.amount||0).toFixed(2)} withdrawal in ${m?.currency?.toUpperCase()||'crypto'}` },
  withdrawal_approved:      { icon: '✅', label: (m) => `withdrawal of $${parseFloat(m?.amount||0).toFixed(2)} was approved` },
  withdrawal_declined:      { icon: '❌', label: (m) => `withdrawal of $${parseFloat(m?.amount||0).toFixed(2)} was declined: ${m?.reason||''}` },
  profile_updated:          { icon: '👤', label: (m) => `updated their profile` },
  password_changed:         { icon: '🔒', label: (m) => `changed their password` },
  swap:                     { icon: '🔄', label: (m) => `swapped $${parseFloat(m?.amount||0).toFixed(2)} from ${m?.from?.toUpperCase()||'?'} to ${m?.to?.toUpperCase()||'?'}` },
};

let refreshTimer = null;

export async function render(container) {
  if (refreshTimer) clearInterval(refreshTimer);

  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Activity Log</h1>
          <p class="page-subtitle">Real-time user activity and system events.</p>
        </div>
        <span class="live-badge"><span class="live-dot"></span> Live · refreshes every 30s</span>
      </div>

      <!-- PDF Download Bar -->
      <div class="pdf-download-bar" id="pdf-bar" style="display:none;">
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
        <button class="btn btn-primary btn-sm" id="download-pdf-btn">⬇ ${t('download')}</button>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;" id="activity-filters">
        <input id="activity-search" class="input-field" placeholder="Search by user or event..." style="flex:1;min-width:200px;max-width:340px;">
        <select id="activity-type-filter" class="input-field" style="width:200px;">
          <option value="all">All Events</option>
          <option value="login">Logins</option>
          <option value="signup">Registrations</option>
          <option value="payment_awaiting_verification">Deposits</option>
          <option value="withdrawal_requested">Withdrawals</option>
          <option value="swap">Swaps</option>
          <option value="profile_updated">Profile Changes</option>
          <option value="password_changed">Password Changes</option>
          <option value="balance_increase">Balance Changes</option>
        </select>
      </div>

      <div class="card card-body" id="activity-wrap">
        <div class="loading-spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  let allLogs = [];

  document.getElementById('activity-search').addEventListener('input', () => renderFiltered());
  document.getElementById('activity-type-filter').addEventListener('change', () => renderFiltered());

  // PDF range toggle
  document.getElementById('pdf-range')?.addEventListener('change', function() {
    document.getElementById('custom-dates').style.display = this.value === 'custom' ? 'flex' : 'none';
  });

  // PDF download
  document.getElementById('download-pdf-btn')?.addEventListener('click', () => {
    const range = document.getElementById('pdf-range')?.value || 'all';
    const now = new Date();
    let filtered = allLogs;
    if (range !== 'all') {
      let from, to;
      if (range === 'custom') {
        const fv = document.getElementById('pdf-from')?.value;
        const tv = document.getElementById('pdf-to')?.value;
        if (!fv || !tv) { toast('Please select from and to dates.', 'error'); return; }
        from = new Date(fv); to = new Date(tv); to.setHours(23,59,59,999);
      } else {
        to = new Date(now); from = new Date(now); from.setDate(from.getDate() - parseInt(range));
      }
      filtered = allLogs.filter(l => { const d = new Date(l.createdAt); return d >= from && d <= to; });
    }
    if (!filtered.length) { toast('No activity in selected date range.', 'error'); return; }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFillColor(11,17,32); doc.rect(0,0,210,28,'F');
      doc.setTextColor(74,222,128); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text('ChainFinex', 14, 12);
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text('Admin Activity Log Report', 14, 20);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      const rows = filtered.map(l => {
        const cfg = TYPE_CFG[l.type] || { icon: '•', label: () => l.type.replace(/_/g,' ') };
        const meta = l.metadata || {};
        return [
          new Date(l.createdAt).toLocaleDateString(),
          l.userName || '—',
          l.userEmail || '—',
          l.type.replace(/_/g,' '),
          cfg.label(meta).replace(/<[^>]+>/g,''),
        ];
      });
      doc.autoTable({
        startY: 34, head: [['Date','User','Email','Event','Details']],
        body: rows, theme: 'striped',
        headStyles: { fillColor: [11,17,32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: [51,65,85] },
        margin: { left: 14, right: 14 },
      });
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148,163,184);
        doc.text('All Rights Reserved © ChainFinex 2026', 14, 290);
        doc.text(`Page ${i} of ${pages}`, 190, 290, { align: 'right' });
      }
      doc.save(`ChainFinex-activity-${Date.now()}.pdf`);
      toast('PDF downloaded!', 'success');
    } catch(err) { toast('Failed to generate PDF: '+err.message, 'error'); }
  });

  function renderFiltered() {
    const search = document.getElementById('activity-search')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('activity-type-filter')?.value || 'all';
    const filtered = allLogs.filter(log => {
      const matchesType = typeFilter === 'all' || log.type === typeFilter;
      const matchesSearch = !search || log.userName.toLowerCase().includes(search) ||
        log.userEmail.toLowerCase().includes(search) || log.type.includes(search);
      return matchesType && matchesSearch;
    });
    renderLogs(filtered);
  }

  function renderLogs(logs) {
    const wrap = document.getElementById('activity-wrap');
    if (!wrap) return;

    if (!logs || logs.length === 0) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:48px 0;color:#94a3b8;">
          <div style="font-size:32px;margin-bottom:8px;">📋</div>
          <p style="font-weight:500;">No activity found</p>
        </div>
      `;
      return;
    }

    const ini = name => (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    wrap.innerHTML = `
      <div class="activity-timeline">
        ${logs.map(log => {
          const cfg = TYPE_CFG[log.type] || { icon: '•', label: () => log.type.replace(/_/g, ' ') };
          const meta = log.metadata || {};
          return `
            <div class="activity-item stagger-item">
              <div class="activity-icon-wrap">${cfg.icon}</div>
              <div class="activity-content">
                <div class="activity-text">
                  <span class="activity-avatar-mini">${ini(log.userName)}</span>
                  <strong style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;"
                    onclick="navigate('/admin/activity')">
                    ${log.userName}
                  </strong>
                  ${cfg.label(meta)}
                </div>
                <div class="activity-meta">
                  ${log.userEmail} · ${timeAgo(log.createdAt)}
                  ${meta.ip ? `· <span class="mono" style="font-size:10px;">${meta.ip}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadActivity() {
    const wrap = document.getElementById('activity-wrap');
    if (!wrap) { clearInterval(refreshTimer); return; }
    try {
      allLogs = await api.adminActivity();
      renderFiltered();
      // Show PDF bar once we have data
      const pdfBar = document.getElementById('pdf-bar');
      if (pdfBar && allLogs.length) pdfBar.style.display = '';
    } catch (err) {
      if (wrap) wrap.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">${err.message}</div>`;
    }
  }

  await loadActivity();
  refreshTimer = setInterval(loadActivity, 30000);
  window.addEventListener('popstate', () => clearInterval(refreshTimer), { once: true });
}
