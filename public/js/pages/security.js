import api from "../api.js";
import { toast, currentUser } from "../app.js";

export async function render(container) {

container.innerHTML = `

<div class="page-inner">

    <div class="page-header">
        <div>
            <h1 class="page-title">Security</h1>
            <p class="page-subtitle">
                Manage your account security.
            </p>
        </div>
    </div>

    <div class="card">

        <div class="card-header">
            <div class="card-title">
                Change Password
            </div>
        </div>

        <div class="card-body">

            <div class="form-row">
                <label class="input-label">
                    Current Password
                </label>

                <input
                    id="currentPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <div class="form-row">
                <label class="input-label">
                    New Password
                </label>

                <input
                    id="newPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <div class="form-row">
                <label class="input-label">
                    Confirm Password
                </label>

                <input
                    id="confirmPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <button
                id="changePasswordBtn"
                class="btn btn-primary">

                Update Password

            </button>

        </div>

    </div>

    <div
        class="card"
        style="margin-top:24px;">

        <div class="card-header">
            <div class="card-title">
                Withdrawal Password
            </div>
        </div>

        <div class="card-body">

    <div class="profile-row">
        <span>Status</span>

        <strong class="${
            currentUser.withdrawPasswordSet ? "green" : "red"
        }">

            ${
                currentUser.withdrawPasswordSet
                    ? "🟢 Protected"
                    : "🔴 Not Set"
            }

        </strong>
    </div>

    ${
        currentUser.withdrawPasswordSet
        ? `
            <div class="form-row">
                <label class="input-label">
                    Current Withdrawal Password
                </label>

                <input
                    id="currentWithdrawPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <div class="form-row">
                <label class="input-label">
                    New Withdrawal Password
                </label>

                <input
                    id="newWithdrawPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <div class="form-row">
                <label class="input-label">
                    Confirm New Password
                </label>

                <input
                    id="confirmWithdrawPassword"
                    type="password"
                    class="input-field"
                >
            </div>
        `
        : `
            <div class="form-row">
                <label class="input-label">
                    Withdrawal Password
                </label>

                <input
                    id="newWithdrawPassword"
                    type="password"
                    class="input-field"
                >
            </div>

            <div class="form-row">
                <label class="input-label">
                    Confirm Withdrawal Password
                </label>

                <input
                    id="confirmWithdrawPassword"
                    type="password"
                    class="input-field"
                >
            </div>
        `
    }

    <button
        id="saveWithdrawPassword"
        class="btn btn-primary">

        ${
            currentUser.withdrawPasswordSet
                ? "Change Withdrawal Password"
                : "Set Withdrawal Password"
        }

    </button>

    ${
        currentUser.withdrawPasswordSet
        ? `<div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:16px;">
            <p style="font-size:13px;color:#64748b;margin:0 0 10px;">Forgot your withdrawal password? <a href="#" id="forgotWithdrawLink" style="color:#22c55e;text-decoration:none;">Reset via email OTP</a></p>
            <div id="forgotWithdrawSection" style="display:none;">
              <div id="forgotWithdrawStep1">
                <button id="sendWithdrawOtpBtn" class="btn btn-primary" style="font-size:13px;padding:8px 16px;">Send OTP to my email</button>
              </div>
              <div id="forgotWithdrawStep2" style="display:none;">
                <p style="font-size:13px;color:#64748b;margin:0 0 10px;">Enter the 6-digit code sent to your email.</p>
                <div class="form-row">
                  <label class="input-label">Verification Code</label>
                  <input id="withdrawOtpInput" type="text" inputmode="numeric" maxlength="6" placeholder="123456" class="input-field" />
                </div>
                <div class="form-row">
                  <label class="input-label">New Withdrawal Password</label>
                  <input id="withdrawNewPw" type="password" class="input-field" placeholder="New password" />
                </div>
                <div class="form-row">
                  <label class="input-label">Confirm New Password</label>
                  <input id="withdrawConfirmPw" type="password" class="input-field" placeholder="Confirm password" />
                </div>
                <button id="submitWithdrawResetBtn" class="btn btn-primary" style="font-size:13px;padding:8px 16px;">Reset Withdrawal Password</button>
              </div>
            </div>
          </div>`
        : ''
    }

</div>
    </div>

</div>

`;

document
.getElementById("changePasswordBtn")
.onclick = async () => {

    const current =
        document.getElementById("currentPassword").value;

    const next =
        document.getElementById("newPassword").value;

    const confirm =
        document.getElementById("confirmPassword").value;

    if (!current || !next || !confirm)
        return toast("Complete all fields","error");

    if (next !== confirm)
        return toast("Passwords do not match","error");

    try {

        await api.changePassword(current,next);

        toast(
            "Password updated successfully.",
            "success"
        );

        document.getElementById("currentPassword").value="";
        document.getElementById("newPassword").value="";
        document.getElementById("confirmPassword").value="";

    } catch(err){

        toast(err.message,"error");

    }

};

document
.getElementById("saveWithdrawPassword")
.onclick = async () => {

    const newPassword =
        document
        .getElementById("newWithdrawPassword")
        .value
        .trim();

    const confirmPassword =
        document
        .getElementById("confirmWithdrawPassword")
        .value
        .trim();

    if (!newPassword || !confirmPassword) {
        return toast(
            "Complete all fields.",
            "error"
        );
    }

    if (newPassword !== confirmPassword) {
        return toast(
            "Passwords do not match.",
            "error"
        );
    }

    try {

        if (currentUser.withdrawPasswordSet) {

            const currentPassword =
                document
                .getElementById("currentWithdrawPassword")
                .value
                .trim();

            if (!currentPassword) {
                return toast(
                    "Enter your current withdrawal password.",
                    "error"
                );
            }

            await api.changeWithdrawPassword(
                currentPassword,
                newPassword
            );

            toast(
                "Withdrawal password changed successfully.",
                "success"
            );

        } else {

            await api.setWithdrawPassword(
                newPassword
            );

            currentUser.withdrawPasswordSet = true;

            toast(
                "Withdrawal password created.",
                "success"
            );

        }

        await render(container);

    } catch (err) {

        toast(
            err.message,
            "error"
        );

    }

};

// ── FORGOT WITHDRAWAL PASSWORD (OTP flow, only shown when password is set) ───
const forgotWithdrawLink = document.getElementById('forgotWithdrawLink');
if (forgotWithdrawLink) {
    forgotWithdrawLink.addEventListener('click', e => {
        e.preventDefault();
        const section = document.getElementById('forgotWithdrawSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('sendWithdrawOtpBtn').addEventListener('click', async () => {
        const btn = document.getElementById('sendWithdrawOtpBtn');
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
            const res = await api.forgotWithdrawPassword();
            const email = res.email || 'your email';
            toast(`OTP sent to ${email}. Check your inbox.`, 'success');
            document.getElementById('forgotWithdrawStep1').style.display = 'none';
            document.getElementById('forgotWithdrawStep2').style.display = 'block';
        } catch (err) {
            toast(err.message || 'Failed to send OTP.', 'error');
            btn.disabled = false;
            btn.textContent = 'Send OTP to my email';
        }
    });

    document.getElementById('submitWithdrawResetBtn').addEventListener('click', async () => {
        const btn = document.getElementById('submitWithdrawResetBtn');
        const otp = document.getElementById('withdrawOtpInput').value.trim();
        const newPw = document.getElementById('withdrawNewPw').value;
        const confirmPw = document.getElementById('withdrawConfirmPw').value;

        if (!otp || otp.length !== 6) return toast('Enter the 6-digit OTP.', 'error');
        if (!newPw) return toast('Enter a new withdrawal password.', 'error');
        if (newPw.length < 6) return toast('Password must be at least 6 characters.', 'error');
        if (newPw !== confirmPw) return toast('Passwords do not match.', 'error');

        btn.disabled = true;
        btn.textContent = 'Resetting…';
        try {
            await api.resetWithdrawPassword(otp, newPw);
            toast('Withdrawal password reset successfully.', 'success');
            await render(container);
        } catch (err) {
            toast(err.message || 'Reset failed. Code may have expired.', 'error');
            btn.disabled = false;
            btn.textContent = 'Reset Withdrawal Password';
        }
    });
}

}