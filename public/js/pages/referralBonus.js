import api from '../api.js';
import { toast } from '../app.js';

export async function render(container) {

  container.innerHTML = `
    <div class="page-inner">

      <div class="page-header">
        <div>
          <h1 class="page-title">
            Referral Bonus
          </h1>

          <p class="page-subtitle">
            Transfer your referral earnings to your main balance.
          </p>
        </div>
      </div>

      <div class="card card-body">

        <h3>Available Bonus</h3>

        <div style="color:#16a34a;font-weight:600;">
        <h1 id="bonusAmount">
          Loading...
        </h1></div>

        <br>

        <button
          id="transferBonus"
          class="btn btn-primary">

          Transfer To Main Balance

        </button>

      </div>

      <br>

      <div class="card card-body">

        <h3>Bonus History</h3>

        <div id="bonusHistory">
          Loading...
        </div>

      </div>

    </div>
  `;

  load();

  async function load() {

    const me = await api.me();

    const bonus =
        Number(me.referral_bonus ?? me.referralBonus ?? 0);

    document.getElementById("bonusAmount").textContent =
        `$${bonus.toFixed(2)}`;

    const history =
      await api.referralHistory();
      console.table(history);

    const list =
      document.getElementById("bonusHistory");

    if (!history.length) {

      list.innerHTML =
        "No referral bonuses yet.";

    } else {

      list.innerHTML = history.map(t => `

        <div style="padding:12px;border-bottom:1px solid #ddd;">

        <div style="color:#16a34a;font-weight:600;">
          <strong>
            +$${Number(t.amount).toFixed(2)}
          </strong></div>

          <br>

          Referral bonus from ${t.users?.name || 'Unknown user'}

          <br>

          <div style="color:#16a34a;font-weight:600;">Completed</div>

          <br>

          <small>${new Date(t.created_at).toLocaleString()}</small>

        </div>

      `).join('');

    }

    document
      .getElementById("transferBonus")
      .onclick = async () => {

        try {

          await api.transferReferralBonus();

          toast(
            "Referral bonus transferred.",
            "success"
          );

          load();

        } catch(e){

          toast(e.message,"error");

        }

      };

  }

}