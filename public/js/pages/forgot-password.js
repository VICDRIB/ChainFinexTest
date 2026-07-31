import api from '../api.js';
import { goToLogin } from '../app.js';

export function renderForgotPassword(root) {
  // Step 1: Enter email
  function renderStep1() {
    root.innerHTML = `
      <div class="auth-brand">
        <div class="logo-mark" style="width:40px;height:40px;font-size:15px;">
        <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
        <span class="auth-brand-text">ChainFinex</span>
      </div>
      <div class="auth-card">
        <h1>Reset Password</h1>
        <p>Enter your email to receive a 6-digit verification code.</p>
        <form id="fp-step1-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="fp-email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-error" id="fp-err" style="margin-bottom:12px;font-size:13px;"></div>
          <button class="btn btn-primary btn-w100" type="submit" id="fp-btn">Send Code</button>
        </form>
        <p style="margin-top:16px;"><a href="#" id="fp-back-login">← Back to Sign In</a></p>
      </div>
    `;

    document.getElementById('fp-back-login').addEventListener('click', e => { e.preventDefault(); goToLogin(); });

    document.getElementById('fp-step1-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('fp-btn');
      const err = document.getElementById('fp-err');
      const email = document.getElementById('fp-email').value.trim();
      err.textContent = '';
      err.classList.remove('visible');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        await api.forgotPassword(email);
        renderStep2(email);
      } catch (ex) {
        err.textContent = ex.message || 'Failed to send code. Try again.';
        err.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Send Code';
      }
    });
  }

  // Step 2: Enter OTP
  function renderStep2(email) {
    root.innerHTML = `
      <div class="auth-brand">
        <div class="logo-mark" style="width:40px;height:40px;font-size:15px;">
        <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
        <span class="auth-brand-text">ChainFinex</span>
      </div>
      <div class="auth-card">
        <h1>Enter Verification Code</h1>
        <p>A 6-digit code was sent to <strong>${email}</strong>. It expires in 10 minutes.</p>
        <form id="fp-step2-form">
          <div class="form-group">
            <label class="form-label">6-Digit Code</label>
            <input class="form-input" id="fp-otp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" autocomplete="one-time-code" required />
          </div>
          <div class="form-error" id="fp-err2" style="margin-bottom:12px;font-size:13px;"></div>
          <button class="btn btn-primary btn-w100" type="submit" id="fp-btn2">Verify Code</button>
        </form>
        <p style="margin-top:16px;">
          <a href="#" id="fp-resend">Resend code</a> &nbsp;·&nbsp;
          <a href="#" id="fp-back2">← Back</a>
        </p>
      </div>
    `;

    document.getElementById('fp-back2').addEventListener('click', e => { e.preventDefault(); renderStep1(); });
    document.getElementById('fp-resend').addEventListener('click', async e => {
      e.preventDefault();
      const link = document.getElementById('fp-resend');
      link.textContent = 'Sending…';
      link.style.pointerEvents = 'none';
      try {
        await api.forgotPassword(email);
        link.textContent = 'Code resent!';
        setTimeout(() => { link.textContent = 'Resend code'; link.style.pointerEvents = ''; }, 3000);
      } catch {
        link.textContent = 'Resend code';
        link.style.pointerEvents = '';
      }
    });

    document.getElementById('fp-step2-form').addEventListener('submit', e => {
      e.preventDefault();
      const otp = document.getElementById('fp-otp').value.trim();
      const err = document.getElementById('fp-err2');
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        err.textContent = 'Please enter the 6-digit code.';
        err.classList.add('visible');
        return;
      }
      err.textContent = '';
      err.classList.remove('visible');
      renderStep3(email, otp);
    });
  }

  // Step 3: Enter new password
  function renderStep3(email, otp) {
    root.innerHTML = `
      <div class="auth-brand">
        <div class="logo-mark" style="width:40px;height:40px;font-size:15px;">
        <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
        <span class="auth-brand-text">ChainFinex</span>
      </div>
      <div class="auth-card">
        <h1>Set New Password</h1>
        <p>Choose a new login password for your account.</p>
        <form id="fp-step3-form">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="password-wrap">
              <input class="form-input" id="fp-new-pw" type="password" placeholder="••••••••" autocomplete="new-password" required />
              <button type="button" class="password-toggle" id="fp-pw-toggle">👁</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input class="form-input" id="fp-confirm-pw" type="password" placeholder="••••••••" autocomplete="new-password" required />
          </div>
          <div class="form-error" id="fp-err3" style="margin-bottom:12px;font-size:13px;"></div>
          <button class="btn btn-primary btn-w100" type="submit" id="fp-btn3">Reset Password</button>
        </form>
        <p style="margin-top:16px;"><a href="#" id="fp-back3">← Back</a></p>
      </div>
    `;

    document.getElementById('fp-back3').addEventListener('click', e => { e.preventDefault(); renderStep2(email); });

    document.getElementById('fp-pw-toggle').addEventListener('click', function() {
      const input = document.getElementById('fp-new-pw');
      input.type = input.type === 'password' ? 'text' : 'password';
      this.textContent = input.type === 'password' ? '👁' : '🙈';
    });

    document.getElementById('fp-step3-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('fp-btn3');
      const err = document.getElementById('fp-err3');
      const newPw = document.getElementById('fp-new-pw').value;
      const confirmPw = document.getElementById('fp-confirm-pw').value;

      err.textContent = '';
      err.classList.remove('visible');

      if (newPw.length < 6) {
        err.textContent = 'Password must be at least 6 characters.';
        err.classList.add('visible');
        return;
      }
      if (newPw !== confirmPw) {
        err.textContent = 'Passwords do not match.';
        err.classList.add('visible');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Resetting…';

      try {
        await api.resetPassword(email, otp, newPw);
        renderSuccess();
      } catch (ex) {
        err.textContent = ex.message || 'Reset failed. The code may have expired — please start over.';
        err.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }
    });
  }

  // Step 4: Success
  function renderSuccess() {
    root.innerHTML = `
      <div class="auth-brand">
        <div class="logo-mark" style="width:40px;height:40px;font-size:15px;">
        <img src="/logos/logo.png" alt="ChainFinex Logo"></div>
        <span class="auth-brand-text">ChainFinex</span>
      </div>
      <div class="auth-card" style="text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">✅</div>
        <h1>Password Reset!</h1>
        <p>Your password has been reset successfully. You can now sign in with your new password.</p>
        <button class="btn btn-primary btn-w100" style="margin-top:8px;" id="fp-go-login">Sign In</button>
      </div>
    `;
    document.getElementById('fp-go-login').addEventListener('click', () => goToLogin());
  }

  renderStep1();
}
