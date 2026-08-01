import {toast } from "../app.js";
import api from '../api.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">

      <div class="page-header">
        <h1 class="page-title">Referral Program</h1>
        <p class="page-subtitle">
          Invite friends and earn referral rewards.
        </p>
      </div>

      <div class="card">
        <div class="card-body" id="referral-content">
          Loading...
        </div>
      </div>

    </div>
  `;

  const info = await api.myReferral();
  console.log(info);

  const link =
    `${window.location.origin}/register?ref=${info.referral_code}`;
    console.log(link);

  document.getElementById('referral-content').innerHTML = `
  
    <div style="margin-bottom:25px;">
      <strong>You can refer users by sharing your referral link:</strong>
    </div>

    <input
  class="form-input"
  id="referral-link"
  readonly
  value="${link}"
  style="
    color:#000;
    background:#fff;
    -webkit-text-fill-color:#000;
    font-family:monospace;
  "
/>

    <button
      class="btn btn-primary"
      id="copy-link"
      style="margin-top:10px;">
      Copy Link
    </button>

    <hr style="margin:25px 0;">

    <div><strong>Referral ID</strong></div>

    <div style="margin-bottom:20px;">
      ${info.referral_code}
    </div>

    <div><strong>You were referred by</strong></div>

    <div style="margin-bottom:20px;">
      ${info.referred_by || 'None'}
    </div>

    <div><strong>Your Referrals</strong></div>

    <div id="referral-users"></div>
  `;

  const users = document.getElementById('referral-users');

  if (!info.referrals.length) {
    users.innerHTML = '<p>No referrals yet.</p>';
  } else {
    users.innerHTML = info.referrals
      .map(user => `
        <div class="card" style="margin-top:12px;">
          <div class="card-body">
            ${user.name}<br>
            <small>${user.email}</small>
          </div>
        </div>
      `)
      .join('');
  }

  document
    .getElementById('copy-link')
    .addEventListener('click', async () => {
      await navigator.clipboard.writeText(link);
      toast('Referral link copied.');
    });
}
