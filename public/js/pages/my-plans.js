import api from "../api.js";
import {
    currentUser,
    formatCurrency,
    navigate
} from "../app.js";

export async function render(container) {

    let plans = [];

try {
    plans = await api.myPlans();

    console.log("Plans:", plans);
    console.table(plans);

} catch (err) {
    console.error("Investment API failed:", err);

    container.innerHTML = `
        <div class="page-inner">
            <h2>My Plans</h2>
            <p style="color:red;">
                Failed to load investments.
            </p>
        </div>
    `;
    return;

}

const activePlans = plans.filter(p => p.status === "active");

const completedPlans = plans.filter(
    p => p.status === "completed"
);

console.log(activePlans);
console.log(completedPlans);

const totalInvested = plans.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
);

const totalProfit = plans.reduce(
    (sum, p) => sum + Number(p.total_profit || 0),
    0
);

container.innerHTML = `
<div class="page-inner">

<div class="page-header">

<div>

<h1 class="page-title">My Investment Plans</h1>

<p class="page-subtitle">
Track your active investments and completed plans.
</p>

</div>

</div>

<div class="grid-4" style="margin-bottom:24px;">

<div class="card stat-card">
<div class="stat-label">💰 Total Invested</div>
<div class="stat-value">${formatCurrency(totalInvested)}</div>
</div>

<div class="card stat-card">
<div class="stat-label">📈 Total Profit</div>
<div class="stat-value green">${formatCurrency(totalProfit)}</div>
</div>

<div class="card stat-card">
<div class="stat-label">🟢 Active</div>
<div class="stat-value">${activePlans.length}</div>
</div>

<div class="card stat-card">
<div class="stat-label">✅ Completed</div>
<div class="stat-value">${completedPlans.length}</div>
</div>

</div>

<div class="plans-section">

<h2 class="section-title">
Active Plans (${activePlans.length})
</h2>

<div class="plans-grid">

${
activePlans.length
?
activePlans.map(plan=>renderPlanCard(plan,false)).join("")
:
`
<div class="card empty-state">

<div class="empty-icon">📈</div>

<h3>No Active Plans</h3>

<p>
You don't currently have any active investments.
</p>

<button
id="browsePlansBtn"
class="btn btn-primary">
Browse Plans
</button>

</div>
`
}

</div>

</div>

<div class="plans-section" style="margin-top:32px;">

<h2 class="section-title">
Investment History (${completedPlans.length})
</h2>

<div class="plans-grid">

${
completedPlans.length
?
completedPlans.map(plan=>renderPlanCard(plan,true)).join("")
:
`
<div class="card empty-state">

<div class="empty-icon">🗂</div>

<h3>No Completed Plans</h3>

</div>
`
}

</div>

</div>

</div>
`;

// Browse Plans button
const browseBtn = document.getElementById("browsePlansBtn");

if (browseBtn) {
    browseBtn.addEventListener("click", () => {
        navigate("/trading-plans");
    });
}

console.log(document.querySelectorAll(".plan-action"));

// View Details / Reinvest buttons
document.querySelectorAll(".plan-action").forEach(btn => {

    btn.addEventListener("click", () => {

        console.log("Button clicked!");

        const id = Number(btn.dataset.id);
        const history = btn.dataset.history === "true";

        const plan = plans.find(p => p.id === id);

        if (!plan) return;

        if (history) {

            sessionStorage.setItem(
                "reinvestPlan",
                JSON.stringify(plan)
            );
            
            navigate("/trading-plans");

            return;

        }

        openPlanDetails(plan);

    });

});

document
    .getElementById("planDrawerOverlay")
    .onclick = closePlanDrawer;
}


function renderPlanCard(plan, history = false) {

    const invested = Number(plan.amount || 0);

    const profit = Number(plan.total_profit || 0);

    const expected = invested + profit;

    const percent =
        history
        ? 100
        : Math.min(
            (Number(plan.days_paid || 0) /
            totalDays(plan.duration)) * 100,
            100
        );

    return `

<div class="card plan-card">

<div class="plan-header">

<div>

<h3>${plan.plan_name}</h3>

<span class="${
history
?
"completed-badge"
:
"active-badge"
}">
${
history
?
"Completed"
:
"Active"
}
</span>

</div>

</div>

${
history
?
""
:
`
<div class="progress">

<div
class="progress-fill"
style="width:${percent}%">
</div>

</div>

<div
style="
font-size:12px;
color:#94a3b8;
margin-bottom:18px;
">

${plan.days_paid || 0}
/
${totalDays(plan.duration)}
Days

</div>
`
}

<div class="plan-row">

<span>Investment</span>

<strong>
${formatCurrency(invested)}
</strong>

</div>

<div class="plan-row">

<span>Profit Earned</span>

<strong class="green">
${formatCurrency(profit)}
</strong>

</div>

<div class="plan-row">

<span>Expected Return</span>

<strong>
${formatCurrency(expected)}
</strong>

</div>

<div class="plan-row">

<span>Daily Profit</span>

<strong>
${plan.daily_profit}%
</strong>

</div>

<div class="plan-row">

<span>
${history ? "Completed" : "Maturity"}
</span>

<strong>

${
history
?
new Date(plan.completed_at).toLocaleDateString()
:
new Date(plan.end_date).toLocaleDateString()
}

</strong>

</div>

<button
class="btn ${
history
?
"btn-secondary"
:
"btn-primary"
} btn-w100 plan-action"
data-id="${plan.id}"
data-history="${history}">

${
history
?
"Reinvest"
:
"View Details"
}

</button>

</div>

`;

}

function totalDays(duration){

    if(!duration) return 30;

    const value=parseInt(duration);

    if(duration.includes("Week"))
        return value*7;

    if(duration.includes("Month"))
        return value*30;

    if(duration.includes("Year"))
        return value*365;

    return value;
}

function openPlanDetails(plan) {

    document.getElementById("planDrawerTitle").textContent =
        plan.plan_name;

    document.getElementById("planDrawerStatus").textContent =
        plan.status.toUpperCase();

    document.getElementById("planDrawerContent").innerHTML = `

<div class="drawer-item">
Investment
<strong>${formatCurrency(plan.amount)}</strong>
</div>

<div class="drawer-item">
Daily Profit
<strong>${plan.daily_profit}%</strong>
</div>

<div class="drawer-item">
Profit Earned
<strong>${formatCurrency(plan.total_profit || 0)}</strong>
</div>

<div class="drawer-item">
Days Paid
<strong>${plan.days_paid}</strong>
</div>

<div class="drawer-item">
Duration
<strong>${plan.duration}</strong>
</div>

<div class="drawer-item">
Started
<strong>${new Date(plan.start_date).toLocaleDateString()}</strong>
</div>

<div class="drawer-item">
Ends
<strong>${new Date(plan.end_date).toLocaleDateString()}</strong>
</div>

`;

    document
        .getElementById("planDrawer")
        .classList.add("open");

    document
        .getElementById("planDrawerOverlay")
        .classList.remove("hidden");
}

function closePlanDrawer() {

    document
        .getElementById("planDrawer")
        .classList.remove("open");

    document
        .getElementById("planDrawerOverlay")
        .classList.add("hidden");

}