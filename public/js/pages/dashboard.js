import api from '../api.js';
import {
  currentUser,
  formatCurrency,
  timeAgo,
  navigate
} from '../app.js';
let investments = [];

const COINS = [
  "btc",
  "eth",
  "usdt",
  "usdc",
  "bnb",
  "sol",
  "trx",
  "xrp",
  "ltc",
  "doge"
];

export async function render(container) {
  container.innerHTML = `<div class="page-inner">
  <div class="page-header">
  <div>
    <h1 class="page-title">
    Hello, ${currentUser?.name || "User"}!
</h1>

<p class="page-subtitle">
    Welcome back. Here's your account summary.
</p>
  </div>

</div>
    <div class="grid-3" id="stat-cards" style="margin-bottom:24px;">
  ${skeletonCard()}${skeletonCard()}${skeletonCard()}
</div>

<div class="card" id="active-plan-card" style="margin-bottom:24px;">
    <div class="card-header">
        <div class="card-title">
            Active Plan(s)
            <span id="active-plan-count">(0)</span>
        </div>
    </div>

    <div class="card-body" id="active-plan-content"></div>
</div>

<div class="card">
    <div class="card-header" style="padding-bottom:16px;">
        <div class="card-title">Transaction History</div>
        <div class="card-desc">Latest account actions</div>
    </div>

    <div class="card-body" id="transaction-history">
        ${[1,2,3,4,5].map(() => `
            <div class="feed-item">
                <div class="skeleton" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:6px;"></div>
                <div style="flex:1">
                    <div class="skeleton" style="height:13px;width:70%;margin-bottom:5px;"></div>
                    <div class="skeleton" style="height:11px;width:30%;"></div>
                </div>
            </div>
        `).join('')}
    </div>
</div>

<div class="card" style="margin-top:24px;">
    <div class="card-header">
        <div class="card-title">
            Refer Us & Earn
        </div>

        <div class="card-desc">
            Use the link below to invite your friends.
        </div>
    </div>

    <div class="card-body">

        <div style="
            display:flex;
            border:1px solid #e5e7eb;
            border-radius:10px;
            overflow:hidden;
        ">

            <input
                id="dashboard-referral-link"
    readonly
    value=""
    style="
        flex:1;
        border:none;
        padding:14px;
        background:#f8fafc;
        font-size:14px;
        outline:none;
    ">

            <button
                id="copy-dashboard-referral"
                class="btn btn-primary"
                style="
                    border-radius:0;
                    min-width:65px;
                ">
                📋
            </button>

        </div>

    </div>
</div>
  </div>`;

  const profileAvatar = document.getElementById("profileAvatar");

  if (profileAvatar) {
    profileAvatar.onclick = openProfileDrawer;
  }

  // Load data in parallel
  const [
    activityData,
    paymentData,
    investmentData,
    referralData,
    portfolioData
] = await Promise.allSettled([
    api.myTransactions(),
    api.paymentAddresses(),
    api.myInvestment(),
    api.myReferral(),
    api.portfolio()
]);

const activity =
activityData.status === 'fulfilled' && Array.isArray(activityData.value)
  ? activityData.value
  : [];

console.table(activity);

const addresses =
paymentData.status === 'fulfilled'
  ? paymentData.value
  : [];

const configuredPayments = addresses.filter(
a => a.address && a.address.trim() !== ''
).length;

const referral =
  referralData.status === "fulfilled"
    ? referralData.value
    : null;

const referralLink = referral
  ? `${window.location.origin}/register?ref=${referral.referral_code}`
  : "";

  investments =
  investmentData.status === 'fulfilled' &&
  Array.isArray(investmentData.value)
    ? investmentData.value
    : [];

    
    const portfolio =
    portfolioData.status === "fulfilled"
        ? portfolioData.value
        : null;

let portfolioTotal = Number(currentUser.balance || 0);

if (portfolio) {

  portfolioTotal = Number(portfolio.balance || 0);

  const wallet = portfolio.wallet || {};
  const prices = portfolio.prices || {};

COINS.forEach(symbol => {
  const amount = Number(wallet[symbol] || 0);
  const price = Number(prices[symbol] || 0);

  portfolioTotal += amount * price;
});

}

  const totalDeposits = activity
  .filter(t =>
    t.type === "deposit" &&
    t.status === "completed"
  )
  .reduce((sum, t) => sum + Number(t.amount || 0), 0);

const totalWithdrawals = activity
  .filter(t =>
    t.type === "withdrawal" &&
    t.status === "completed"
  )
  .reduce((sum, t) => sum + Number(t.amount || 0), 0);

const totalProfits = activity
  .filter(t =>
    t.type === "profit" &&
    t.status === "completed"
  )
  .reduce((sum, t) => sum + Number(t.amount || 0), 0);

//const totalProfits = investments.reduce(
 // (sum, p) => sum + Number(p.total_profit || 0),
  //0
//);

    const planCount = document.getElementById('active-plan-count');
    const planContent = document.getElementById('active-plan-content');
    
    if (investments.length > 0) {
      renderActivePlans();
  } else {
      planCount.textContent = "(0)";
  
      planContent.innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
              <div style="font-size:15px;color:#64748b;margin-bottom:24px;">
                  You do not have an active investment plan at the moment.
              </div>
  
              <button class="btn btn-primary" id="buy-plan-btn">
                  Buy a Plan
              </button>
          </div>
      `;
  
      document
          .getElementById("buy-plan-btn")
          .onclick = () => navigate("/trading-plans");
  }
    

  // Render stat cards
  const statCards = document.getElementById('stat-cards');
  const isAdmin = currentUser?.role === 'admin';

  statCards.innerHTML = `
    <div
  class="card stat-card stagger-item"
  style="cursor:pointer"
  onclick="navigate('/portfolio')">

  <div class="stat-label">
    💰 My Balance
  </div>

  <div class="stat-value green">
    ${formatCurrency(portfolioTotal)}
</div>

  <div class="stat-meta">
    Click to view your portfolio
  </div>

</div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/crypto')">
      <div class="stat-label"><span class="live-dot"></span> 📈 Crypto Market</div>
      <div class="stat-value green">10</div>
      <div class="stat-meta"><span class="live-dot"></span> Live Prices</div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/profit-history')">
      <div class="stat-label">↗️ Total Profits</div>
      <div class="stat-value green">${formatCurrency(totalProfits)}</div>
      <div class="stat-meta">Profits Acquired</div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/bonus')">
      <div class="stat-label">🎁 Bonus</div>
      <div class="stat-value green">
      ${formatCurrency(currentUser?.bonus || 0)}
      </div>
      <div class="stat-meta">My Bonus</div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/referral-bonus')">
      <div class="stat-label">🎁 Referral Bonus</div>
      <div class="stat-value green">
      ${formatCurrency(currentUser?.referralBonus || 0)}
      </div>
      <div class="stat-meta"></div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/deposits')">
      <div class="stat-label">🏦 Total Deposit</div>
      <div class="stat-value">${formatCurrency(totalDeposits)}</div>
      <div class="stat-meta">My Total Deposit</div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/withdrawals')">
      <div class="stat-label">📥 Total Withdrawal</div>
      <div class="stat-value">${formatCurrency(totalWithdrawals)}</div>
      <div class="stat-meta">My Total Withdrawal</div>
    </div>
    <div class="card stat-card stagger-item" style="cursor:pointer;" onclick="navigate('/payments')">
      <div class="stat-label">💳 Payments</div>
      <div class="stat-value">${configuredPayments}</div>
      <div class="stat-meta">Configured methods</div>
    </div>
  `;

  // Render transaction history
  const feedEl = document.getElementById('transaction-history');
  if (!activity || activity.length === 0) {
    feedEl.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:24px 0;font-size:13px;">No recent transaction</p>`;
  } else {
    feedEl.innerHTML = activity.slice(0, 5).map(item => `
      <div class="feed-item">
        <div class="feed-dot"></div>
        <div>
          <div class="feed-text">
            ${
              item.type === 'set'
                ? 'Balance updated'
                : item.type === 'increase'
                ? 'Deposit'
                : item.type === 'decrease'
                ? 'Withdrawal'
                : item.type
            }
          </div>
          <div class="feed-time">${item.amount} • ${timeAgo(item.created_at)}${item.meta ? ` · <span style="background:#f1f5f9;padding:1px 6px;border-radius:3px;font-size:10px;text-transform:uppercase;">${item.meta}</span>` : ''}</div>
        </div>
      </div>
    `).join('') + `

<div style="text-align:center;margin-top:18px;">
    <button
        class="btn btn-outline"
        id="view-transactions-btn">
        View More Transactions
    </button>
</div>

`;
  }
  const buyBtn = document.getElementById('buy-plan-btn');

  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
    navigate('/trading-plans');
  });
}

const viewTransactionsBtn =
document.getElementById("view-transactions-btn");

if (viewTransactionsBtn) {

    viewTransactionsBtn.onclick = () => {

        navigate("/transactions");

    };

}

const referralInput = document.getElementById("dashboard-referral-link");

if (referralInput) {
    referralInput.value = referralLink;
}

const copyReferralBtn =
document.getElementById("copy-dashboard-referral");

if (copyReferralBtn) {

    copyReferralBtn.onclick = async () => {

        const input =
        document.getElementById("dashboard-referral-link");

        await navigator.clipboard.writeText(input.value);

        copyReferralBtn.textContent = "✓";

        setTimeout(() => {

            copyReferralBtn.textContent = "📋";

        }, 1500);

    };

}

}

function renderActivePlans() {

  const planCount = document.getElementById("active-plan-count");
  const planContent = document.getElementById("active-plan-content");

  planCount.textContent = `(${investments.length})`;

  planContent.innerHTML = `

      ${investments.slice(0,2).map(plan => `

          <div class="card" style="margin-bottom:16px;">
              <div class="card-body">

                  <div style="
                      display:flex;
                      justify-content:space-between;
                      align-items:flex-start;
                  ">

                      <div>

                          <div style="font-size:18px;font-weight:700;">
                              ${plan.plan_name}
                          </div>

                          <div style="margin-top:8px;">
                              Invested: ${formatCurrency(plan.amount)}
                          </div>

                          <div style="margin-top:4px;color:#22c55e;">
                              ${plan.daily_profit}% Daily Profit
                          </div>

                          <div style="margin-top:4px;">
                              ${plan.duration}
                          </div>

                          <div>
                              Days Remaining:
                              <strong>${daysRemaining(plan.created_at, plan.duration)}</strong>
                          </div>

                      </div>

                      <span style="
                          background:#dcfce7;
                          color:#15803d;
                          padding:6px 14px;
                          border-radius:999px;
                          font-size:12px;
                          font-weight:600;
                          align-self:flex-start;
                          white-space:nowrap;
                      ">
                          ACTIVE
                      </span>

                  </div>

              </div>

          </div>

      `).join("")}

      <div style="display:flex;gap:10px;margin-top:20px;">

          <button
              class="btn btn-secondary"
              id="view-more-plans-btn"
              style="flex:1;">
              View More Plans
          </button>

          <button
              class="btn btn-primary"
              id="buy-another-plan-btn"
              style="flex:1;">
              Buy Another Plan
          </button>

      </div>

  `;

  document
      .getElementById("buy-another-plan-btn")
      .onclick = () => navigate("/trading-plans");

  document
      .getElementById("view-more-plans-btn")
      .onclick = showAllPlans;
}

function showAllPlans() {

  const planContent = document.getElementById("active-plan-content");

  planContent.innerHTML = `

      ${investments.map(plan => `

          <div class="card" style="margin-bottom:16px;">

              <div class="card-body">

                  <div style="
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
">

                      <div>

                          <div style="font-size:18px;font-weight:700;">
                              ${plan.plan_name}
                          </div>

                          <div style="margin-top:8px;">
                              Invested:
                              ${formatCurrency(plan.amount)}
                          </div>

                          <div style="margin-top:4px;color:#22c55e;">
                              ${plan.daily_profit}% Daily Profit
                          </div>

                          <div style="margin-top:4px;">
                              ${plan.duration}
                          </div>

                          <div>
                              Days Remaining:
                              <strong>
                                  ${daysRemaining(plan.created_at, plan.duration)}
                              </strong>
                          </div>

                      </div>

                      <span
    style="
        background:#dcfce7;
        color:#15803d;
        padding:6px 14px;
        border-radius:999px;
        font-size:12px;
        font-weight:600;
        align-self:flex-start;
        white-space:nowrap;
">
                          ACTIVE
                      </span>

                  </div>

              </div>

          </div>

      `).join("")}

      <div style="display:flex;gap:10px;margin-top:20px;">

    <button
        class="btn btn-secondary"
        id="close-plans-btn"
        style="flex:1;">
        Close
    </button>

    <button
        class="btn btn-primary"
        id="view-all-plans-btn"
        style="flex:1;">
        View All Plans
    </button>

</div>

  `;

  document
    .getElementById("close-plans-btn")
    .addEventListener("click", () => {

        renderActivePlans();

    });

  document
      .getElementById("view-all-plans-btn")
      .addEventListener("click", () => {

          navigate("/my-plans");

      });

    }

function daysRemaining(createdAt, duration) {
  const start = new Date(createdAt);
  const end = new Date(start);

  const value = parseInt(duration);

  if (duration.includes('Week')) {
    end.setDate(end.getDate() + value * 7);
  } else if (duration.includes('Month')) {
    end.setMonth(end.getMonth() + value);
  } else if (duration.includes('Year')) {
    end.setFullYear(end.getFullYear() + value);
  }

  const diff = end - new Date();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'Completed';
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function skeletonCard() {
  return `<div class="card stat-card"><div class="skeleton" style="height:11px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:36px;width:40%;margin-bottom:8px;"></div><div class="skeleton" style="height:13px;width:50%;"></div></div>`;
}
