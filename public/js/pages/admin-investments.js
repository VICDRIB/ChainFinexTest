import api from '../api.js';
import { formatCurrency, toast } from '../app.js';

// ── localStorage helpers for last-click tracking ─────────────────────────────
function getLastClick(invId) {
  try { return JSON.parse(localStorage.getItem(`profit_click_${invId}`)) || null; }
  catch { return null; }
}
function setLastClick(invId, percentage) {
  localStorage.setItem(`profit_click_${invId}`, JSON.stringify({
    percentage,
    datetime: new Date().toLocaleString(),
  }));
}
function clearLastClick(invId) {
  localStorage.removeItem(`profit_click_${invId}`);
}

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <h1 class="page-title">Investments</h1>
        <p class="page-subtitle">
          Manage all active investments.
        </p>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;">

  <button
    class="btn btn-primary"
    id="active-tab">
    🟢 Active Investments
  </button>

  <button
    class="btn"
    id="completed-tab">
    ⚫ Completed Investments
  </button>

</div>

      <div style="margin-bottom:20px;">
  <input
    id="investment-search"
    class="input"
    type="text"
    placeholder="🔍 Search user by name or email..."
  />
</div>

<div style="display:flex;gap:10px;margin-bottom:20px;">
  <button class="btn btn-primary" id="expand-all-btn">
    📂 Expand All
  </button>

  <button class="btn" id="collapse-all-btn">
    📁 Collapse All
  </button>
</div>

<div id="investment-list"></div>
    </div>
  `;

  const list = document.getElementById('investment-list');

  try {
    const investments = await api.adminInvestments();
    const searchInput = document.getElementById('investment-search');

    if (!investments.length) {
      list.innerHTML = `
        <div class="card">
          <div class="card-body">
            No active investments.
          </div>
        </div>
      `;
      return;
    }

    function renderInvestments(filter = '', status = 'active') {

      const grouped = {};
    
      investments.forEach(inv => {
    
        const userName = inv.users?.name || 'Unknown User';
        const userEmail = inv.users?.email || '';

        if (inv.status !== status) {
          return;
        }
    
        if (
          filter &&
          !userName.toLowerCase().includes(filter.toLowerCase()) &&
          !userEmail.toLowerCase().includes(filter.toLowerCase())
        ) {
          return;
        }
    
        if (!grouped[userName]) {
          grouped[userName] = [];
        }
    
        grouped[userName].push(inv);
    
      });
    
      list.innerHTML = Object.entries(grouped).map(([user, items], index) => `
<div class="card" style="margin-bottom:20px;">

<div
  class="card-header"
  style="cursor:pointer;padding:18px;"
  onclick="toggleUserInvestments(${index})">

  <div style="display:flex;justify-content:space-between;align-items:center;">

    <div>
      <div style="font-size:18px;font-weight:700;">
        👤 ${user}
      </div>

      <div style="font-size:13px;color:#64748b;">
        ${items[0].users?.email || ''}
      </div>
    </div>

    <div style="text-align:right;">
      <div style="font-weight:600;">
        ${items.length}
        Investment${items.length > 1 ? 's' : ''}
      </div>

      <div style="font-size:12px;color:#64748b;">
        Click to view
      </div>
    </div>

  </div>

</div>

  <div
    id="user-investments-${index}"
    style="display:none;padding:20px;">

    <div
    style="
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:12px;
    margin-bottom:20px;
  ">

  <div class="card">
    <div class="card-body">
      <div style="font-size:12px;color:#64748b;">
        Total Invested
      </div>

      <div style="font-size:20px;font-weight:700;">
        ${formatCurrency(
          items.reduce((sum, i) => sum + Number(i.amount), 0)
        )}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-body">
      <div style="font-size:12px;color:#64748b;">
        Profit Paid
      </div>

      <div style="font-size:20px;font-weight:700;color:#16a34a;">
        ${formatCurrency(
          items.reduce((sum, i) => sum + Number(i.total_profit), 0)
        )}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-body">
      <div style="font-size:12px;color:#64748b;">
        Active Investments
      </div>

      <div style="font-size:20px;font-weight:700;">
        ${items.length}
      </div>
    </div>
  </div>

</div>

    ${items.map(inv => `

      <div class="card" style="margin-bottom:16px;">
        <div class="card-body">

          <div><strong>Plan:</strong> ${inv.plan_name}</div>

          <div><strong>Invested:</strong> ${formatCurrency(inv.amount)}</div>

          <div><strong>Daily Profit:</strong> ${inv.daily_profit}%</div>

          <div><strong>Duration:</strong> ${inv.duration}</div>

          <div><strong>Daily Payouts:</strong> ${inv.days_paid} / ${inv.total_days}</div>

          <div><strong>Total Profit Paid:</strong> ${formatCurrency(inv.total_profit)}</div>

          <div>
            <strong>Status:</strong>
            <span style="color:${inv.status === 'active' ? '#22c55e' : '#ef4444'}">
              ${inv.status}
            </span>
          </div>

          ${
  inv.status === 'active'
    ? `
      <div style="margin-top:15px;">

        ${
          inv.last_paid_date === new Date().toISOString().split('T')[0]
            ? `
              <div style="display:inline-block;padding:6px 14px;background:#16a34a;color:#fff;border-radius:6px;font-size:13px;font-weight:600;margin-bottom:10px;">
                ✔️ Paid Today
              </div>
            `
            : `
              <div style="margin-bottom:6px;font-size:12px;color:#64748b;font-weight:600;">
                💰 Select daily profit %:
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">
                ${Array.from({length: 39}, (_, i) => i + 2).map(p => `
                  <button
                    class="btn profit-pct-btn"
                    data-id="${inv.id}"
                    data-pct="${p}"
                    title="Pay ${p}% daily profit"
                    style="font-size:11px;padding:4px 9px;min-width:38px;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;">
                    ${p}%
                  </button>
                `).join('')}
              </div>
            `
        }

        <button
          class="btn btn-danger end-investment-btn"
          data-id="${inv.id}">
          🛑 End Investment
        </button>

      </div>
    `
    : `
      <div style="margin-top:15px;padding:12px;background:#f8fafc;border-radius:8px;">

        <div>
          <strong>Completed On:</strong>
          ${inv.completed_at
            ? new Date(inv.completed_at).toLocaleDateString()
            : '-'}
        </div>

      </div>
    `
}

        </div>
      </div>

    `).join('')}

  </div>

</div>
`).join('');

    }

    let currentStatus = 'active';

    renderInvestments('', currentStatus);

    searchInput.addEventListener('input', e => {
      renderInvestments(e.target.value, currentStatus);
    });

    document.getElementById('active-tab').addEventListener('click', () => {
      currentStatus = 'active';

      document.getElementById('active-tab').classList.add('btn-primary');
      document.getElementById('completed-tab').classList.remove('btn-primary');

      renderInvestments(searchInput.value, currentStatus);
    });

    document.getElementById('completed-tab').addEventListener('click', () => {
      currentStatus = 'completed';

      document.getElementById('completed-tab').classList.add('btn-primary');
      document.getElementById('active-tab').classList.remove('btn-primary');

      renderInvestments(searchInput.value, currentStatus);
    });

    // ── Percentage profit button handler (event delegation) ─────────────────
    list.addEventListener('click', async (e) => {
      const pctBtn = e.target.closest('.profit-pct-btn');
      if (!pctBtn) return;

      const invId = pctBtn.dataset.id;
      const percentage = Number(pctBtn.dataset.pct);

      const last = getLastClick(invId);

      if (last) {
        const proceed = confirm(
          `You just clicked ${last.percentage}% at ${last.datetime} last.\nWould you like to continue and pay ${percentage}% profit?`
        );
        if (!proceed) {
          // Admin said No — cancel, do not clear the stored last click
          return;
        }
      }

      // Record this click before making the API call
      setLastClick(invId, percentage);

      try {
        await api.payInvestment(invId, percentage);
        toast(`${percentage}% profit paid successfully.`, 'success');
        render(container);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ── End investment button handler (event delegation) ─────────────────────
    list.addEventListener('click', async (e) => {
      const endBtn = e.target.closest('.end-investment-btn');
      if (!endBtn) return;

      if (!confirm('End this investment?')) return;

      try {
        await api.endInvestment(endBtn.dataset.id);
        clearLastClick(endBtn.dataset.id);
        toast('Investment ended successfully.', 'success');
        render(container);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('expand-all-btn').addEventListener('click', () => {
      document.querySelectorAll('[id^="user-investments-"]').forEach(box => {
        box.style.display = 'block';
      });
    });
    
    document.getElementById('collapse-all-btn').addEventListener('click', () => {
      document.querySelectorAll('[id^="user-investments-"]').forEach(box => {
        box.style.display = 'none';
      });
    });

  } catch (err) {
    list.innerHTML = err.message;
  } 
}

window.toggleUserInvestments = function(index) {
    const box = document.getElementById(`user-investments-${index}`);
  
    if (box.style.display === 'none') {
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  };
