import api from '../api.js';
import { currentUser, formatCurrency, toast } from '../app.js';
let selectedPlan = null;
let reinvestPlan = null;

export async function render(container) {

  reinvestPlan = JSON.parse(
    sessionStorage.getItem("reinvestPlan")
);

  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Trading Plans</h1>
          <p class="page-subtitle">Choose an investment plan that suits you.</p>
        </div>
      </div>

      <div class="grid-2" style="align-items:start;gap:24px;">
      <div id="plans-grid" class="grid-2"></div>

      <div class="card">
        <div class="card-header">
        <div class="card-title">Your Investment Details</div>
      </div>

      <div class="card-body" id="plan-details">
        <p>Select a plan to continue.</p>
      </div>
    </div>
    </div>
    </div>
  `;

  await loadPlans();
}

async function loadPlans() {
    const grid = document.getElementById('plans-grid');
  
    try {
      const plans = await api.getPlans();////////////////////
  
      grid.innerHTML = plans.map(plan => `
        <div class="card trading-plan-card"
             data-id="${plan.id}"
             style="cursor:pointer;">
          <div class="card-body">
            <h3>${plan.name}</h3>
  
            <div style="margin:10px 0;">
              <strong>${formatCurrency(plan.plan_price)}</strong>
            </div>
  
            <div>${plan.daily_profit}% Daily</div>
            <div>${plan.duration}</div>
          </div>
        </div>
      `).join('');
  
      document.querySelectorAll('.trading-plan-card').forEach(card => {
        card.onclick = () => {
          const id = Number(card.dataset.id);
          selectedPlan = plans.find(p => p.id === id);
  
          document.querySelectorAll('.trading-plan-card')
            .forEach(c => c.classList.remove('selected'));
  
          card.classList.add('selected');
  
          updatePlanDetails();
        };
      });

      if (reinvestPlan) {

        const card = document.querySelector(
          `.trading-plan-card[data-id="${reinvestPlan.plan_id}"]`
      );
    
        if (card) {
    
            card.click();
    
        }
    
        sessionStorage.removeItem("reinvestPlan");
    
        reinvestPlan = null;
    
    }
  
    } catch (err) {
      grid.innerHTML = err.message;
    }
  }

  function updatePlanDetails() {
    if (!selectedPlan) return;
  
    document.getElementById('plan-details').innerHTML = `
  <div><strong>Name of plan</strong><br>${selectedPlan.name}</div><br>

  <div><strong>Plan Price</strong><br>${formatCurrency(selectedPlan.plan_price)}</div><br>

  <div><strong>Duration</strong><br>${selectedPlan.duration}</div><br>

  <div><strong>Profit</strong><br>${selectedPlan.daily_profit}% Daily</div><br>

  <div><strong>Minimum Deposit</strong><br>${formatCurrency(selectedPlan.min_deposit)}</div><br>

  <div><strong>Maximum Deposit</strong><br>${formatCurrency(selectedPlan.max_deposit)}</div><br>

  <div><strong>Minimum Return</strong><br>${selectedPlan.min_return}%</div><br>

  <div><strong>Maximum Return</strong><br>${selectedPlan.max_return}%</div>

  <hr style="margin:20px 0;">

  <div style="font-weight:600;margin-bottom:10px;">
    Choose Quick Amount to Invest
  </div>

  <div class="quick-amounts">
    <button class="quick-amount" data-amount="100">$100</button>
    <button class="quick-amount" data-amount="250">$250</button>
    <button class="quick-amount" data-amount="500">$500</button>
    <button class="quick-amount" data-amount="1000">$1,000</button>
    <button class="quick-amount" data-amount="1500">$1,500</button>
    <button class="quick-amount" data-amount="2000">$2,000</button>
  </div>
  <hr style="margin:20px 0;">

<div style="font-weight:600;margin-bottom:10px;">
  Or Enter Your Amount
</div>

<input
  id="investment-amount"
  value="${reinvestPlan ? reinvestPlan.amount : ""}"
  type="number"
  class="input-field"
  placeholder="0"
  min="0"
/>

<hr style="margin:20px 0;">

<div style="font-weight:600;margin-bottom:10px;">
  Choose Payment Method
</div>

<div class="card" style="margin-bottom:16px;">
  <div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:600;">Account Balance</div>
        <div style="font-size:13px;color:#64748b;">
          Balance:
          <strong id="account-balance">${formatCurrency(currentUser.balance)}</strong>
        </div>
      </div>

      <div style="font-size:22px;">💳</div>
    </div>
  </div>
</div>

<button
  id="invest-btn"
  class="btn btn-primary btn-w100">
  Invest Now
</button>
`;

document.querySelectorAll('.quick-amount').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('investment-amount').value = btn.dataset.amount;
    };
  });
  
  document.getElementById('invest-btn').onclick = async () => {
    let investAmount = Number(
      document.getElementById('investment-amount').value
    );
  
    // If no amount was entered, use the selected plan price
    if (!investAmount || investAmount <= 0) {
      investAmount = Number(selectedPlan.plan_price);
    }
  
    try {
      const result = await api.createInvestment(selectedPlan.id, investAmount);
  
      toast(result.message || 'Investment created successfully.', 'success');
  
      window.location.href = '/dashboard';
  
    } catch (err) {
      toast(err.message || 'You need to fund your account first.', 'error');
    }
  };
  }