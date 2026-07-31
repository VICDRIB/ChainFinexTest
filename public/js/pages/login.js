import api from '../api.js';
import { onLoginSuccess, goToRegister, goToForgotPassword } from '../app.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="auth-brand">
      <div class="logo-mark"style="width:40px;height:40px;font-size:15px;">
      <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
      <span class="auth-brand-text">ChainFinex</span>
      </div>
    <div class="auth-card">
      <h1>Sign in to your account</h1>
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          <div class="form-error" id="email-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div class="password-wrap">
            <input class="form-input" id="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
            <button type="button" class="password-toggle" id="pw-toggle">👁</button>
          </div>
          <div class="form-error" id="pw-err"></div>
        </div>
        <p>Don't have an account? <a href="#" id="go-register">Register</a></p>
          <p style="margin-top:4px;"><a href="#" id="go-forgot">Forgot password?</a></p>
        <div class="form-error" id="form-err" style="margin-bottom:12px;font-size:13px;"></div>
        <button class="btn btn-primary btn-w100" type="submit" id="submit-btn">Sign In</button>
      </form>
    </div>
  `;

  document.getElementById('go-register').addEventListener('click', e => { e.preventDefault(); goToRegister(); });
  document.getElementById('go-forgot').addEventListener('click', e => { e.preventDefault(); goToForgotPassword(); });

  document.getElementById('pw-toggle').addEventListener('click', function() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
    this.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const formErr = document.getElementById('form-err');
    formErr.textContent = '';
    formErr.classList.remove('visible');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const user = await api.login(
        document.getElementById('email').value.trim(),
        document.getElementById('password').value
      );
      onLoginSuccess(user);
    } catch (err) {
      formErr.textContent = err.message || 'Login failed';
      formErr.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
