import api from '../api.js';
import { onLoginSuccess, goToLogin } from '../app.js';

export function renderRegister(root) {
  root.innerHTML = `
    <div class="auth-brand">
      <div class="logo-mark" style="width:40px;height:40px;font-size:15px;">
      <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
      <span class="auth-brand-text">ChainFinex</span>
    </div>
    <div class="auth-card">
      <h1>Create your account</h1>
      <p>Already have an account? <a href="#" id="go-login">Sign in</a></p>
      <form id="register-form">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-input" id="name" type="text" placeholder="Jane Doe" autocomplete="name" required />
          <div class="form-error" id="name-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          <div class="form-error" id="email-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div class="password-wrap">
            <input class="form-input" id="password" type="password" placeholder="Min. 6 characters" autocomplete="new-password" required minlength="6" />
            <button type="button" class="password-toggle" id="pw-toggle">👁</button>
          </div>
          <div class="form-error" id="pw-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input class="form-input" id="confirm" type="password" placeholder="Repeat password" autocomplete="new-password" required />
          <div class="form-error" id="confirm-err"></div>
        </div>
        <div class="form-group">
        <label class="form-label">
          Referral ID (Optional)
        </label>

        <input
          class="form-input"
          id="referral"
          type="text"
          placeholder="Enter referral ID"
        />
        </div>
        <div class="form-error" id="form-err" style="margin-bottom:12px;font-size:13px;"></div>
        <button class="btn btn-primary btn-w100" type="submit" id="submit-btn">Create Account</button>
      </form>
    </div>
  `;

  const params = new URLSearchParams(window.location.search);
const referral = params.get('ref');

if (referral) {
  document.getElementById('referral').value = referral;
}

  document.getElementById('go-login').addEventListener('click', e => { e.preventDefault(); goToLogin(); });

  document.getElementById('pw-toggle').addEventListener('click', function() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
    this.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const formErr = document.getElementById('form-err');
    const pw = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    formErr.textContent = '';
    formErr.classList.remove('visible');

    if (pw.length < 6) {
      document.getElementById('pw-err').textContent = 'Password must be at least 6 characters';
      document.getElementById('pw-err').classList.add('visible');
      return;
    }
    if (pw !== confirm) {
      document.getElementById('confirm-err').textContent = 'Passwords do not match';
      document.getElementById('confirm-err').classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const user = await api.register(
        document.getElementById('name').value.trim(),
        document.getElementById('email').value.trim(),
        pw,
        document.getElementById('referral').value.trim()
      );
      onLoginSuccess(user);
    } catch (err) {
      formErr.textContent = err.message || 'Registration failed';
      formErr.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}
