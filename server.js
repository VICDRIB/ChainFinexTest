console.log("SERVER FILE LOADED");
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const nodemailer = require('nodemailer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'ChainFinex-dev-secret-change-in-production';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── OTP STORE (in-memory, 10-minute TTL) ──────────────────────────────────────
// Key format: `login:<email>` or `withdraw:<userId>`
const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(key, otpHash) {
  otpStore.set(key, { otpHash, expires: Date.now() + 10 * 60 * 1000, used: false });
}

async function verifyAndConsumeOTP(key, otp) {
  const entry = otpStore.get(key);
  if (!entry) return { ok: false, error: 'No OTP found. Please request a new one.' };
  if (entry.used) return { ok: false, error: 'This OTP has already been used.' };
  if (Date.now() > entry.expires) {
    otpStore.delete(key);
    return { ok: false, error: 'OTP has expired. Please request a new one.' };
  }
  const valid = await bcrypt.compare(otp, entry.otpHash);
  if (!valid) return { ok: false, error: 'Invalid OTP. Please try again.' };
  otpStore.delete(key);
  return { ok: true };
}

// Clean up expired OTPs every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (now > entry.expires) otpStore.delete(key);
  }
}, 15 * 60 * 1000);

// ── EMAIL SERVICE ─────────────────────────────────────────────────────────────
let emailTransporter = null;

function getTransporter() {
  if (emailTransporter) return emailTransporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return emailTransporter;
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return; // Email not configured, silently skip
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ChainFinex <noreply@ChainFinex.io>',
      to, subject, html, text,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function emailTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
.wrapper{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.header{background:#0f172a;padding:28px 32px;text-align:center}
.header h1{color:#4ade80;margin:0;font-size:22px;font-weight:700}
.header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.body{padding:32px}
.body p{color:#334155;line-height:1.6;font-size:14px;margin:0 0 16px}
.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0}
.info-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155}
.info-row:last-child{border-bottom:none}
.label{color:#64748b}
.value{font-weight:600}
.status-pending{color:#f59e0b;font-weight:700}
.status-completed{color:#22c55e;font-weight:700}
.status-declined{color:#ef4444;font-weight:700}
.btn{display:inline-block;background:#22c55e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
.footer{background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head>
<body>
<div class="wrapper">
  <div class="header"><h1>ChainFinex</h1><p>Your Financial Dashboard</p></div>
  <div class="body">
    <h2 style="color:#0f172a;margin:0 0 16px;font-size:18px">${title}</h2>
    ${bodyHtml}
  </div>
  <div class="footer">© ${new Date().getFullYear()} ChainFinex. This is an automated notification.</div>
</div>
</body></html>`;
}

// ── NOTIFICATION HELPERS ──────────────────────────────────────────────────────
async function createNotification(userId, type, title, message, data = {}) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      read: false,
    });
  } catch (err) {
    console.error('Notification insert failed:', err.message);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ error: 'Not authenticated' });
  const { data: user, error } = await supabase
    .from('users').select('*').eq('id', req.session.userId).single();
  if (error || !user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  req.adminUser = user;
  next();
}

async function logActivity(userId, type, metadata) {
  await supabase.from('activity_logs').insert({ user_id: userId, type, metadata });
}

function safeJson(str) {
  if (!str) return {};
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return str; }
}

async function getClientLocation(ip) {
  try {
    const cleanIp = (ip || '').replace(/^::ffff:/, '');
    if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1') return 'Local/Unknown';
    const r = await fetch(`http://ip-api.com/json/${cleanIp}?fields=country,regionName,city,status`);
    if (!r.ok) return 'Unknown';
    const data = await r.json();
    if (data.status === 'success') return `${data.city}, ${data.regionName}, ${data.country}`;
    return 'Unknown';
  } catch { return 'Unknown'; }
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data: user, error } = await supabase
  .from('users')
  .insert({
    name,
    email,
    password_hash: hash,
    role: 'user',

    balance: 0,
    bonus: 500,

    referral_bonus: 0,

    referral_code: referralCode,
    referred_by: referredBy || null,
  })
  .select()
  .single();

    if (error) return res.status(500).json({ error: error.message });

    req.session.userId = user.id;

    // ── WELCOME BONUS: $500 credited to new user's bonus wallet ──────────────
    await supabase
  .from('users')
  .update({
    bonus: 500
  })
  .eq('id', user.id);
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'welcome_bonus',
      amount: 500,
      status: 'completed',
      description: 'Welcome bonus – $500 credited to your bonus wallet. Transfer to main wallet anytime.',
    });
    await createNotification(user.id, 'bonus', '🎉 Welcome Bonus!',
      'You have received a $500 welcome bonus in your bonus wallet. Go to Bonus to transfer it to your main wallet.',
      { amount: 500, type: 'welcome_bonus' }
    );

    // Log activity + notify admin of new signup
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const location = await getClientLocation(ip);
    const loginTime = new Date().toLocaleString();

    await logActivity(user.id, 'signup', { name, email, ip, location });

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New Account Created – ${name}`,
        html: emailTemplate('New User Registration', `
          <p>A new user has registered on ChainFinex.</p>
          <div class="info-box">
            <div class="info-row"><span class="label">Name</span><span class="value">${name}</span></div>
            <div class="info-row"><span class="label">Email</span><span class="value">${email}</span></div>
            <div class="info-row"><span class="label">Location</span><span class="value">${location}</span></div>
            <div class="info-row"><span class="label">Time</span><span class="value">${loginTime}</span></div>
            <div class="info-row"><span class="label">IP</span><span class="value">${ip}</span></div>
          </div>
        `),
      });
    }

    // Create admin site notification
    const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
    if (adminUsers) {
      for (const admin of adminUsers) {
        await createNotification(admin.id, 'new_user', `New user registered: ${name}`,
          `${name} (${email}) created an account. Location: ${location} at ${loginTime}`,
          { userId: user.id, location, loginTime, ip }
        );
      }
    }

    // Welcome email to user
    await sendEmail({
      to: email,
      subject: 'Welcome to ChainFinex!',
      html: emailTemplate('Welcome to ChainFinex!', `
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account has been created successfully. You can now log in and start managing your finances.</p>
        <a href="${APP_URL}" class="btn">Go to ChainFinex</a>
        <p style="color:#94a3b8;font-size:12px">If you did not create this account, please contact support immediately.</p>
      `),
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const location = await getClientLocation(ip);
  const loginTime = new Date().toLocaleString();

  await logActivity(user.id, 'login', { email, ip, location });

  // Create notification for user
  await createNotification(user.id, 'login', 'New Login',
    `Your account was accessed from ${location} at ${loginTime}`,
    { ip, location, loginTime }
  );

  // Email user about login
  await sendEmail({
    to: user.email,
    subject: 'New Login to Your ChainFinex Account',
    html: emailTemplate('New Login Detected', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>We detected a new login to your ChainFinex account.</p>
      <div class="info-box">
        <div class="info-row"><span class="label">Time</span><span class="value">${loginTime}</span></div>
        <div class="info-row"><span class="label">Location</span><span class="value">${location}</span></div>
        <div class="info-row"><span class="label">IP Address</span><span class="value">${ip}</span></div>
      </div>
      <p>If this was not you, please change your password immediately.</p>
    `),
  });

  // Notify admin by email and site notification
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `User Login – ${user.name}`,
      html: emailTemplate('User Login', `
        <p>A user has logged in to ChainFinex.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Name</span><span class="value">${user.name}</span></div>
          <div class="info-row"><span class="label">Email</span><span class="value">${user.email}</span></div>
          <div class="info-row"><span class="label">Location</span><span class="value">${location}</span></div>
          <div class="info-row"><span class="label">Time</span><span class="value">${loginTime}</span></div>
          <div class="info-row"><span class="label">IP</span><span class="value">${ip}</span></div>
        </div>
      `),
    });
  }

  // Admin site notification of login
  const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
  if (adminUsers) {
    for (const admin of adminUsers) {
      if (admin.id !== user.id) {
        await createNotification(admin.id, 'user_login', `${user.name} logged in`,
          `${user.name} (${user.email}) logged in from ${location} at ${loginTime}`,
          { userId: user.id, location, loginTime, ip }
        );
      }
    }
  }

  res.json({
    id: user.id, name: user.name, email: user.email, role: user.role,
    balance: user.balance, createdAt: user.created_at,
    avatarUrl: user.avatar_url,
    withdrawPasswordSet: !!user.withdraw_password_hash,
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { data: user, error } = await supabase.from('users').select('*').eq('id', req.session.userId).single();
  if (error || !user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  
    balance: user.balance,
    bonus: user.bonus || 0,
  
    createdAt: user.created_at,
    avatarUrl: user.avatar_url,
    phone: user.phone,
    date_of_birth: user.date_of_birth,
    country: user.country,
    address: user.address,
  
    withdrawPasswordSet: !!user.withdraw_password_hash,
  
    referral_code: user.referral_code,
    referred_by: user.referred_by,
    referral_bonus: user.referral_bonus || 0,
  });
});

// ── AVATAR ────────────────────────────────────────────────────────────────────
app.post('/api/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const fileName = `avatars/${req.session.userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, {
    contentType: req.file.mimetype, upsert: true,
  });
  if (uploadError) return res.status(500).json({ error: uploadError.message });
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const avatarUrl = data.publicUrl;
  const { error: updateError } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', req.session.userId);
  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ avatarUrl });
});

// ── PROFILE ───────────────────────────────────────────────────────────────────
app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email, phone, date_of_birth, country, address } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

  const { data, error } = await supabase.from('users')
    .update({ name, email, phone, date_of_birth, country, address })
    .eq('id', req.session.userId).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await logActivity(req.session.userId, 'profile_updated', { name, email });
  await createNotification(req.session.userId, 'profile', 'Profile Updated', 'Your profile information was updated successfully.');

  // Email notification
  await sendEmail({
    to: data.email,
    subject: 'Profile Updated – ChainFinex',
    html: emailTemplate('Profile Updated', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your profile information has been updated successfully.</p>
      <div class="info-box">
        <div class="info-row"><span class="label">Name</span><span class="value">${name}</span></div>
        <div class="info-row"><span class="label">Email</span><span class="value">${email}</span></div>
        ${phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${phone}</span></div>` : ''}
        ${country ? `<div class="info-row"><span class="label">Country</span><span class="value">${country}</span></div>` : ''}
      </div>
      <p>If you did not make this change, please contact support immediately.</p>
    `),
  });

  res.json(data);
});

app.put('/api/profile/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Current and new password are required.' });

  const { data: user, error } = await supabase.from('users').select('id, name, email, password_hash').eq('id', req.session.userId).single();
  if (error || !user) return res.status(404).json({ error: 'User not found.' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase.from('users').update({ password_hash: hash }).eq('id', req.session.userId);
  if (updateError) return res.status(500).json({ error: updateError.message });

  await logActivity(req.session.userId, 'password_changed', {});
  await createNotification(req.session.userId, 'security', 'Password Changed', 'Your account password was changed successfully.');

  await sendEmail({
    to: user.email,
    subject: 'Password Changed – ChainFinex',
    html: emailTemplate('Password Changed', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your account password has been changed successfully.</p>
      <p>If you did not make this change, please contact support immediately and reset your password.</p>
    `),
  });

  res.json({ success: true });
});

app.put('/api/profile/withdraw-password', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password is required.' });
  const hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('users').update({ withdraw_password_hash: hash, withdraw_password_set: true }).eq('id', req.session.userId);
  if (error) return res.status(500).json({ error: error.message });

  await createNotification(req.session.userId, 'security', 'Withdrawal Password Set', 'Your withdrawal password has been created successfully.');

  const { data: user } = await supabase.from('users').select('email, name').eq('id', req.session.userId).single();
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Withdrawal Password Set – ChainFinex',
      html: emailTemplate('Withdrawal Password Set', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your withdrawal password has been created. You will need this password to submit withdrawal requests.</p>
        <p>If you did not do this, please contact support immediately.</p>
      `),
    });
  }

  res.json({ success: true });
});

app.put('/api/profile/change-withdraw-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords are required.' });

  const { data: user, error } = await supabase.from('users').select('id, name, email, withdraw_password_hash').eq('id', req.session.userId).single();
  if (error || !user) return res.status(404).json({ error: 'User not found.' });
  if (!user.withdraw_password_hash) return res.status(400).json({ error: 'Withdrawal password has not been set.' });

  const valid = await bcrypt.compare(currentPassword, user.withdraw_password_hash);
  if (!valid) return res.status(400).json({ error: 'Current withdrawal password is incorrect.' });

  const hash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase.from('users').update({ withdraw_password_hash: hash }).eq('id', req.session.userId);
  if (updateError) return res.status(500).json({ error: updateError.message });

  await createNotification(req.session.userId, 'security', 'Withdrawal Password Changed', 'Your withdrawal password has been updated.');
  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Password Changed – ChainFinex',
    html: emailTemplate('Withdrawal Password Changed', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your withdrawal password has been changed successfully.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `),
  });

  res.json({ success: true });
});

// ── FORGOT / RESET LOGIN PASSWORD (public, no session required) ───────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const { data: user } = await supabase.from('users').select('id, name, email').eq('email', email.toLowerCase().trim()).single();
  // Always respond with success to avoid leaking which emails exist
  if (!user) return res.json({ success: true });

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  storeOTP(`login:${email.toLowerCase().trim()}`, otpHash);

  await sendEmail({
    to: user.email,
    subject: 'Password Reset OTP – ChainFinex',
    html: emailTemplate('Password Reset OTP', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>We received a request to reset your ChainFinex login password.</p>
      <p>Use the following 6-digit code to reset your password. It expires in <strong>10 minutes</strong> and can only be used once.</p>
      <div class="info-box" style="text-align:center;padding:24px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0f172a;">${otp}</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Expires in 10 minutes</div>
      </div>
      <p>If you did not request this, you can safely ignore this email. Your password will not change.</p>
    `),
  });

  res.json({ success: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const key = `login:${email.toLowerCase().trim()}`;
  const result = await verifyAndConsumeOTP(key, otp);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const { data: user } = await supabase.from('users').select('id, name, email').eq('email', email.toLowerCase().trim()).single();
  if (!user) return res.status(404).json({ error: 'Account not found.' });

  const hash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase.from('users').update({ password_hash: hash }).eq('id', user.id);
  if (updateError) return res.status(500).json({ error: updateError.message });

  await logActivity(user.id, 'password_reset', { email: user.email });
  await createNotification(user.id, 'security', 'Password Reset', 'Your account password was reset successfully via OTP.');

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Successful – ChainFinex',
    html: emailTemplate('Password Reset Successful', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your ChainFinex login password has been reset successfully.</p>
      <p>You can now log in with your new password.</p>
      <p>If you did not do this, please contact support immediately.</p>
    `),
  });

  res.json({ success: true });
});

// ── FORGOT / RESET WITHDRAWAL PASSWORD (requires session) ─────────────────────
app.post('/api/profile/forgot-withdraw-password', requireAuth, async (req, res) => {
  const { data: user } = await supabase.from('users').select('id, name, email').eq('id', req.session.userId).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  storeOTP(`withdraw:${req.session.userId}`, otpHash);

  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Password Reset OTP – ChainFinex',
    html: emailTemplate('Withdrawal Password Reset OTP', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>We received a request to reset your ChainFinex withdrawal password.</p>
      <p>Use the following 6-digit code to reset your withdrawal password. It expires in <strong>10 minutes</strong> and can only be used once.</p>
      <div class="info-box" style="text-align:center;padding:24px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0f172a;">${otp}</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px;">Expires in 10 minutes</div>
      </div>
      <p>If you did not request this, please contact support immediately.</p>
    `),
  });

  res.json({ success: true, email: user.email });
});

app.post('/api/profile/reset-withdraw-password', requireAuth, async (req, res) => {
  const { otp, newPassword } = req.body;
  if (!otp || !newPassword)
    return res.status(400).json({ error: 'OTP and new password are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const key = `withdraw:${req.session.userId}`;
  const result = await verifyAndConsumeOTP(key, otp);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const { data: user } = await supabase.from('users').select('id, name, email').eq('id', req.session.userId).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const hash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase.from('users').update({ withdraw_password_hash: hash, withdraw_password_set: true }).eq('id', user.id);
  if (updateError) return res.status(500).json({ error: updateError.message });

  await logActivity(user.id, 'withdraw_password_reset', {});
  await createNotification(user.id, 'security', 'Withdrawal Password Reset', 'Your withdrawal password was reset successfully via OTP.');

  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Password Reset Successful – ChainFinex',
    html: emailTemplate('Withdrawal Password Reset Successful', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your ChainFinex withdrawal password has been reset successfully.</p>
      <p>If you did not do this, please contact support immediately.</p>
    `),
  });

  res.json({ success: true });
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', req.session.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.session.userId)
    .eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  await supabase.from('notifications').update({ read: true })
    .eq('id', req.params.id).eq('user_id', req.session.userId);
  res.json({ success: true });
});

app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', req.session.userId).eq('read', false);
  res.json({ success: true });
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  res.json({ portfolioCount: 0, totalPortfolioValue: 0, totalGainLoss: 0, totalGainLossPercent: 0, topHoldings: [], assetBreakdown: [] });
});

app.get('/api/dashboard/my-activity', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', req.session.userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(l => ({
    id: l.id, description: l.type.replace(/_/g, ' '),
    timestamp: l.created_at, meta: l.type, metadata: safeJson(l.metadata)
  })));
});

app.get('/api/dashboard/transactions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions').select('*')
    .eq('user_id', req.session.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── CRYPTO ────────────────────────────────────────────────────────────────────
const SUPPORTED_COINS = {
  btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', usdc: 'usd-coin',
  bnb: 'binancecoin', sol: 'solana', trx: 'tron', xrp: 'ripple',
  ltc: 'litecoin', doge: 'dogecoin'
};

let cachedPrices = null;
let lastPriceUpdate = 0;
let marketCache = null;
let marketCacheTime = 0;
const chartCache = {};

async function getCoinPrices() {
  if (cachedPrices && Date.now() - lastPriceUpdate < 60000) return cachedPrices;
  const ids = Object.values(SUPPORTED_COINS).join(',');
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  if (!response.ok) { if (cachedPrices) return cachedPrices; throw new Error(`CoinGecko returned ${response.status}`); }
  const data = await response.json();
  const prices = {};
  for (const [symbol, id] of Object.entries(SUPPORTED_COINS)) prices[symbol] = Number(data[id]?.usd || 0);
  cachedPrices = prices;
  lastPriceUpdate = Date.now();
  return prices;
}

app.get('/api/crypto/coins', requireAuth, async (req, res) => {
  try {
    if (marketCache && Date.now() - marketCacheTime < 60000) return res.json(marketCache);
    const ids = Object.values(SUPPORTED_COINS).join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;
    const r = await fetch(url);
    if (!r.ok) { if (marketCache) return res.json(marketCache); return res.status(502).json({ error: 'CoinGecko unavailable' }); }
    const data = await r.json();
    marketCache = data; marketCacheTime = Date.now();
    res.json(data);
  } catch (e) {
    if (marketCache) return res.json(marketCache);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/crypto/:coinId/chart', requireAuth, async (req, res) => {
  try {
    const coinId = req.params.coinId;
    const days = req.query.days || '7';
    const cacheKey = `${coinId}-${days}`;
    if (chartCache[cacheKey] && Date.now() - chartCache[cacheKey].time < 60000) return res.json(chartCache[cacheKey].data);
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    const r = await fetch(url);
    if (!r.ok) { if (chartCache[cacheKey]) return res.json(chartCache[cacheKey].data); return res.status(502).json({ error: 'CoinGecko unavailable' }); }
    const data = await r.json();
    chartCache[cacheKey] = { data, time: Date.now() };
    res.json(data);
  } catch (e) {
    const cacheKey = `${req.params.coinId}-${req.query.days || '7'}`;
    if (chartCache[cacheKey]) return res.json(chartCache[cacheKey].data);
    res.status(500).json({ error: e.message });
  }
});

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
app.get('/api/payment-addresses', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('payment_addresses').select('*').order('type');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/payments/submit', requireAuth, async (req, res) => {
  const { amount, method } = req.body;
  if (!amount || !method) return res.status(400).json({ error: 'amount and method required' });

  const { data: payment, error } = await supabase.from('pending_payments').insert({
    user_id: req.session.userId,
    amount: parseFloat(amount),
    method,
    status: 'awaiting_verification',
    submitted_at: new Date(),
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await logActivity(req.session.userId, 'payment_awaiting_verification', { amount, method, paymentId: payment.id });

  // User notification
  await createNotification(req.session.userId, 'deposit', 'Deposit Submitted',
    `Your deposit of $${parseFloat(amount).toFixed(2)} via ${method.toUpperCase()} has been submitted and is pending verification.`,
    { amount, method, paymentId: payment.id, status: 'pending' }
  );

  // Email user
  const { data: user } = await supabase.from('users').select('name, email').eq('id', req.session.userId).single();
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Deposit Submitted – ChainFinex',
      html: emailTemplate('Deposit Submitted', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your deposit request has been received and is pending verification by our team.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Amount</span><span class="value">$${parseFloat(amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Method</span><span class="value">${method.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Status</span><span class="value status-pending">Pending Verification</span></div>
          <div class="info-row"><span class="label">Submitted</span><span class="value">${new Date().toLocaleString()}</span></div>
        </div>
        <p>We will notify you once your deposit has been verified.</p>
      `),
    });
  }

  // Notify admin
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New Deposit – ${user?.name || 'User'}`,
      html: emailTemplate('New Deposit Request', `
        <p>A new deposit has been submitted and requires your approval.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">User</span><span class="value">${user?.name}</span></div>
          <div class="info-row"><span class="label">Email</span><span class="value">${user?.email}</span></div>
          <div class="info-row"><span class="label">Amount</span><span class="value">$${parseFloat(amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Method</span><span class="value">${method.toUpperCase()}</span></div>
        </div>
        <a href="${APP_URL}/admin/pending-payments" class="btn">Review Deposit</a>
      `),
    });
  }

  // Admin site notification
  const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
  if (adminUsers) {
    for (const admin of adminUsers) {
      await createNotification(admin.id, 'admin_deposit', `New deposit from ${user?.name}`,
        `${user?.name} submitted a deposit of $${parseFloat(amount).toFixed(2)} via ${method.toUpperCase()}`,
        { userId: req.session.userId, amount, method, paymentId: payment.id }
      );
    }
  }

  res.status(201).json(payment);
});

app.get('/api/payments/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('pending_payments').select('*')
    .eq('user_id', req.session.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── WITHDRAWALS ───────────────────────────────────────────────────────────────
app.post('/api/withdrawals', requireAuth, async (req, res) => {
  const { currency, amount, walletAddress, withdrawalPassword } = req.body;

  if (!currency || !amount || !walletAddress || !withdrawalPassword)
    return res.status(400).json({ error: 'All fields are required.' });

  const withdrawAmount = Number(amount);
  if (withdrawAmount <= 0) return res.status(400).json({ error: 'Invalid amount.' });

  const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', req.session.userId).single();
  if (userError || !user) return res.status(404).json({ error: 'User not found.' });

  if (!user.withdraw_password_hash)
    return res.status(400).json({ error: 'Please set a withdrawal password in Security settings first.' });

  const validPassword = await bcrypt.compare(withdrawalPassword, user.withdraw_password_hash);
  if (!validPassword) return res.status(400).json({ error: 'Incorrect withdrawal password.' });

  // Balance logic: first try main balance, then use crypto wallets if needed
  const mainBalance = Number(user.balance) - Number(user.pending_withdrawal || 0);
  let deductFromBalance = 0;
  let deductFromCrypto = 0;
  let source = 'balance';

  if (mainBalance >= withdrawAmount) {
    deductFromBalance = withdrawAmount;
    source = 'balance';
  } else {
    // Check total available (main + crypto)
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
    const prices = await getCoinPrices().catch(() => null);
    let cryptoValueUsd = 0;
    if (wallet && prices) {
      for (const coin of Object.keys(SUPPORTED_COINS)) {
        cryptoValueUsd += (wallet[coin] || 0) * (prices[coin] || 0);
      }
    }
    const totalAvailable = mainBalance + cryptoValueUsd;
    if (withdrawAmount > totalAvailable) {
      return res.status(400).json({ error: `Insufficient balance. Available: $${totalAvailable.toFixed(2)}` });
    }
    deductFromBalance = mainBalance;
    deductFromCrypto = withdrawAmount - mainBalance;
    source = 'mixed';
  }

  // Save pending withdrawal
  const { data: withdrawal, error: insertError } = await supabase.from('withdrawals').insert({
    user_id: user.id,
    currency,
    amount: withdrawAmount,
    wallet_address: walletAddress,
    source,
    status: 'pending',
  }).select().single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  // Track pending withdrawal
  await supabase.from('users').update({
    pending_withdrawal: Number(user.pending_withdrawal || 0) + withdrawAmount
  }).eq('id', user.id);

  await logActivity(req.session.userId, 'withdrawal_requested', { currency, amount: withdrawAmount, walletAddress });

  // User notification
  await createNotification(req.session.userId, 'withdrawal', 'Withdrawal Requested',
    `Your withdrawal request of $${withdrawAmount.toFixed(2)} in ${currency.toUpperCase()} is pending admin approval.`,
    { withdrawalId: withdrawal.id, currency, amount: withdrawAmount, walletAddress, status: 'pending' }
  );

  // Email user
  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Request Submitted – ChainFinex',
    html: emailTemplate('Withdrawal Request Submitted', `
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your withdrawal request has been submitted and is awaiting admin approval.</p>
      <div class="info-box">
        <div class="info-row"><span class="label">Amount</span><span class="value">$${withdrawAmount.toFixed(2)}</span></div>
        <div class="info-row"><span class="label">Crypto</span><span class="value">${currency.toUpperCase()}</span></div>
        <div class="info-row"><span class="label">Wallet</span><span class="value" style="font-size:11px;word-break:break-all">${walletAddress}</span></div>
        <div class="info-row"><span class="label">Status</span><span class="value status-pending">Pending Approval</span></div>
        <div class="info-row"><span class="label">Submitted</span><span class="value">${new Date().toLocaleString()}</span></div>
      </div>
      <p>You will be notified once your withdrawal is approved or declined.</p>
    `),
  });

  // Notify admin
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New Withdrawal Request – ${user.name}`,
      html: emailTemplate('New Withdrawal Request', `
        <p>A user has submitted a withdrawal request requiring your approval.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">User</span><span class="value">${user.name}</span></div>
          <div class="info-row"><span class="label">Email</span><span class="value">${user.email}</span></div>
          <div class="info-row"><span class="label">Amount</span><span class="value">$${withdrawAmount.toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Crypto</span><span class="value">${currency.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Wallet</span><span class="value" style="font-size:11px;word-break:break-all">${walletAddress}</span></div>
        </div>
        <a href="${APP_URL}/admin/withdrawals" class="btn">Review Withdrawal</a>
      `),
    });
  }

  // Admin site notification
  const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
  if (adminUsers) {
    for (const admin of adminUsers) {
      await createNotification(admin.id, 'admin_withdrawal', `New withdrawal from ${user.name}`,
        `${user.name} requested a withdrawal of $${withdrawAmount.toFixed(2)} in ${currency.toUpperCase()}`,
        { userId: user.id, withdrawalId: withdrawal.id, currency, amount: withdrawAmount }
      );
    }
  }

  res.json({ success: true, message: 'Withdrawal request submitted. Pending approval.' });
});

app.get('/api/withdrawals', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('withdrawals').select('*')
    .eq('user_id', req.session.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── ADMIN WITHDRAWALS ─────────────────────────────────────────────────────────
app.get('/api/admin/withdrawals', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('withdrawals')
    .select('*, users(name, email)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/withdrawals/:id/approve', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data: withdrawal, error } = await supabase.from('withdrawals').select('*').eq('id', id).single();
  if (error || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found.' });
  if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed.' });

  const { data: user } = await supabase.from('users').select('balance, pending_withdrawal, name, email').eq('id', withdrawal.user_id).single();

  await supabase.from('withdrawals').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', id);
  await supabase.from('users').update({
    balance: Math.max(0, Number(user.balance) - Number(withdrawal.amount)),
    pending_withdrawal: Math.max(0, Number(user.pending_withdrawal || 0) - Number(withdrawal.amount))
  }).eq('id', withdrawal.user_id);

  await supabase.from('transactions').insert({
    user_id: withdrawal.user_id,
    type: 'withdrawal',
    amount: withdrawal.amount,
    status: 'completed',
    description: `${withdrawal.currency.toUpperCase()} Withdrawal to ${withdrawal.wallet_address}`,
  });

  await logActivity(withdrawal.user_id, 'withdrawal_approved', {
    amount: withdrawal.amount, currency: withdrawal.currency,
    adminId: req.adminUser.id, adminName: req.adminUser.name
  });

  // User notification
  await createNotification(withdrawal.user_id, 'withdrawal', 'Withdrawal Approved ✓',
    `Your withdrawal of $${Number(withdrawal.amount).toFixed(2)} in ${withdrawal.currency.toUpperCase()} has been approved and is being processed.`,
    { withdrawalId: id, currency: withdrawal.currency, amount: withdrawal.amount, status: 'approved' }
  );

  // Email user
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Withdrawal Approved – ChainFinex',
      html: emailTemplate('Withdrawal Approved', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your withdrawal request has been approved. The funds will be sent to your wallet shortly.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Amount</span><span class="value">$${Number(withdrawal.amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Crypto</span><span class="value">${withdrawal.currency.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Wallet</span><span class="value" style="font-size:11px;word-break:break-all">${withdrawal.wallet_address}</span></div>
          <div class="info-row"><span class="label">Status</span><span class="value status-completed">Approved</span></div>
        </div>
      `),
    });
  }

  res.json({ success: true });
});

app.post('/api/admin/withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;

  const { data: withdrawal, error } = await supabase.from('withdrawals').select('*').eq('id', id).single();
  if (error || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found.' });
  if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed.' });

  await supabase.from('withdrawals').update({
    status: 'declined',
    decline_reason: reason || 'No reason provided',
    processed_at: new Date().toISOString(),
  }).eq('id', id);

  await supabase.from('users').update({
    pending_withdrawal: supabase.rpc ? undefined : undefined,
  });

  // Restore pending withdrawal
  const { data: user } = await supabase.from('users').select('pending_withdrawal, name, email').eq('id', withdrawal.user_id).single();
  if (user) {
    await supabase.from('users').update({
      pending_withdrawal: Math.max(0, Number(user.pending_withdrawal || 0) - Number(withdrawal.amount))
    }).eq('id', withdrawal.user_id);
  }

  await logActivity(withdrawal.user_id, 'withdrawal_declined', {
    amount: withdrawal.amount, currency: withdrawal.currency,
    reason: reason || 'No reason provided',
    adminId: req.adminUser.id, adminName: req.adminUser.name
  });

  // User notification
  await createNotification(withdrawal.user_id, 'withdrawal', 'Withdrawal Declined',
    `Your withdrawal of $${Number(withdrawal.amount).toFixed(2)} in ${withdrawal.currency.toUpperCase()} was declined. Reason: ${reason || 'No reason provided'}`,
    { withdrawalId: id, currency: withdrawal.currency, amount: withdrawal.amount, status: 'declined', reason }
  );

  // Email user
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Withdrawal Declined – ChainFinex',
      html: emailTemplate('Withdrawal Declined', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Unfortunately, your withdrawal request has been declined.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Amount</span><span class="value">$${Number(withdrawal.amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Crypto</span><span class="value">${withdrawal.currency.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Status</span><span class="value status-declined">Declined</span></div>
          <div class="info-row"><span class="label">Reason</span><span class="value">${reason || 'No reason provided'}</span></div>
        </div>
        <p>Your funds remain in your account. Please contact support if you have questions.</p>
      `),
    });
  }

  res.json({ success: true });
});

// ── ADMIN PAYMENTS ────────────────────────────────────────────────────────────
app.get('/api/admin/pending-payments', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('pending_payments')
    .select('*, users(name, email)').eq('status', 'awaiting_verification')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/pending-payments/:id/approve', requireAdmin, async (req, res) => {
  const paymentId = parseInt(req.params.id);
  const { data: payment, error } = await supabase.from('pending_payments').select('*').eq('id', paymentId).single();
  if (error || !payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'awaiting_verification') return res.status(400).json({ error: 'Payment already processed' });

  const { data: user } = await supabase.from('users').select('balance, name, email').eq('id', payment.user_id).single();
  const newBalance = Number(user.balance) + Number(payment.amount);

  await supabase.from('users').update({ balance: newBalance }).eq('id', payment.user_id);
  await supabase.from('pending_payments').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', paymentId);
  await supabase.from('transactions').insert({
    user_id: payment.user_id, type: 'deposit',
    amount: payment.amount, status: 'completed',
    description: `${payment.method.toUpperCase()} Deposit`,
  });

  // Referral bonus
  const { data: depositor } = await supabase.from('users').select('id, name, referred_by, referral_bonus_paid').eq('id', payment.user_id).single();
  if (depositor?.referred_by && !depositor?.referral_bonus_paid) {
    const { data: referrer } = await supabase.from('users').select('id, referral_bonus').eq('referral_code', depositor.referred_by).single();
    if (referrer) {
      const bonus = Number(payment.amount) * 0.05;
      await supabase.from('users').update({ referral_bonus: Number(referrer.referral_bonus || 0) + bonus }).eq('id', referrer.id);
      await supabase.from('referral_bonus_history').insert({ user_id: referrer.id, referred_user_id: depositor.id, amount: bonus });
      await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral_reward', amount: bonus, status: 'Received', description: `Referral bonus from ${depositor.name}` });
      await supabase.from('users').update({ referral_bonus_paid: true }).eq('id', depositor.id);
    }
  }

  // Notify user
  await createNotification(payment.user_id, 'deposit', 'Deposit Approved ✓',
    `Your deposit of $${Number(payment.amount).toFixed(2)} via ${payment.method.toUpperCase()} has been approved and added to your balance.`,
    { paymentId, amount: payment.amount, method: payment.method, status: 'approved' }
  );

  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Deposit Approved – ChainFinex',
      html: emailTemplate('Deposit Approved', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your deposit has been verified and added to your account balance.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Amount</span><span class="value">$${Number(payment.amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Method</span><span class="value">${payment.method.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">New Balance</span><span class="value">$${newBalance.toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Status</span><span class="value status-completed">Approved</span></div>
        </div>
      `),
    });
  }

  res.json({ success: true });
});

app.post('/api/admin/pending-payments/:id/reject', requireAdmin, async (req, res) => {
  const paymentId = parseInt(req.params.id);
  const { reason } = req.body;

  const { data: payment, error } = await supabase.from('pending_payments').select('*').eq('id', paymentId).single();
  if (error || !payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'awaiting_verification') return res.status(400).json({ error: 'Payment has already been processed' });

  await supabase.from('pending_payments').update({
    status: 'rejected', rejected_at: new Date().toISOString(),
    reject_reason: reason || 'No reason provided'
  }).eq('id', paymentId);

  const { data: user } = await supabase.from('users').select('name, email').eq('id', payment.user_id).single();

  // Notify user
  await createNotification(payment.user_id, 'deposit', 'Deposit Rejected',
    `Your deposit of $${Number(payment.amount).toFixed(2)} via ${payment.method.toUpperCase()} was rejected. Reason: ${reason || 'No reason provided'}`,
    { paymentId, amount: payment.amount, method: payment.method, status: 'rejected', reason }
  );

  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Deposit Rejected – ChainFinex',
      html: emailTemplate('Deposit Rejected', `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Unfortunately, your deposit could not be verified.</p>
        <div class="info-box">
          <div class="info-row"><span class="label">Amount</span><span class="value">$${Number(payment.amount).toFixed(2)}</span></div>
          <div class="info-row"><span class="label">Method</span><span class="value">${payment.method.toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Status</span><span class="value status-declined">Rejected</span></div>
          <div class="info-row"><span class="label">Reason</span><span class="value">${reason || 'No reason provided'}</span></div>
        </div>
        <p>Please contact support if you believe this is a mistake.</p>
      `),
    });
  }

  res.json({ success: true });
});

// ── REFERRAL ──────────────────────────────────────────────────────────────────
app.get('/api/referral', requireAuth, async (req, res) => {
  const { data: user, error: userError } = await supabase.from('users').select('id, referral_code, referred_by').eq('id', req.session.userId).single();
  if (userError || !user) return res.status(404).json({ error: 'User not found' });
  const { data: referrals } = await supabase.from('users').select('id, name, email, created_at').eq('referred_by', user.referral_code).order('created_at', { ascending: false });
  res.json({ referral_code: user.referral_code, referred_by: user.referred_by, referrals: referrals || [] });
});

app.get('/api/referral/history', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('referral_bonus_history').select('*, users!referral_bonus_history_referred_user_id_fkey(name, email)').eq('user_id', req.session.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/bonus/history', requireAuth, async (req, res) => {

  const { data, error } = await supabase
    .from('bonus_history')
    .select('*')
    .eq('user_id', req.session.userId)
    .order('created_at', { ascending: false });

  if (error)
    return res.status(500).json({ error: error.message });

  res.json(data || []);
});

app.post('/api/referral/transfer', requireAuth, async (req, res) => {
  const { data: user, error } = await supabase.from('users').select('id, balance, referral_bonus').eq('id', req.session.userId).single();
  if (error || !user) return res.status(404).json({ error: 'User not found.' });
  const bonus = Number(user.referral_bonus || 0);
  if (bonus <= 0) return res.status(400).json({ error: 'No referral bonus available.' });
  const newBalance = Number(user.balance) + bonus;
  const { error: updateError } = await supabase.from('users').update({ balance: newBalance, referral_bonus: 0 }).eq('id', user.id);
  if (updateError) return res.status(500).json({ error: updateError.message });
  await supabase.from('transactions').insert({ user_id: user.id, type: 'referral_bonus', amount: bonus, status: 'completed', description: 'Referral bonus transferred to main balance' });
  res.json({ success: true, transferred: bonus, newBalance });
});

app.post('/api/bonus/transfer', requireAuth, async (req, res) => {

  const { data: user, error } = await supabase
    .from('users')
    .select('id, balance, bonus')
    .eq('id', req.session.userId)
    .single();

  if (error || !user)
    return res.status(404).json({ error: 'User not found.' });

  const bonus = Number(user.bonus || 0);

  if (bonus <= 0)
    return res.status(400).json({ error: 'No bonus available.' });

  const newBalance = Number(user.balance) + bonus;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      balance: newBalance,
      bonus: 0
    })
    .eq('id', user.id);

  if (updateError)
    return res.status(500).json({ error: updateError.message });

  const { data: txData, error: txError } = await supabase
  .from('transactions')
  .insert({
    user_id: user.id,
    type: 'bonus',
    amount: bonus,
    status: 'completed',
    description: 'Welcome bonus transferred to main balance'
  })
  .select();

console.log("BONUS TRANSACTION:", txData);
console.log("BONUS TRANSACTION ERROR:", txError);

    const { error: historyError } = await supabase
  .from('bonus_history')
  .insert({
    user_id: user.id,
    amount: bonus,
    type: 'welcome_bonus'
  });

console.log("Bonus history error:", historyError);

  res.json({
    success: true,
    transferred: bonus,
    newBalance
  });

});

// ── MEMBERS ───────────────────────────────────────────────────────────────────
app.get('/api/members', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/members', requireAdmin, async (req, res) => {
  const { name, role, email } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];
  const { data, error } = await supabase.from('members').insert({ name, role, email, initials, avatar_color }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/members/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('members').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── PLANS & INVESTMENTS ───────────────────────────────────────────────────────
app.get('/api/plans', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('plans').select('*').order('plan_price');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/investments', requireAuth, async (req, res) => {
  const { planId, amount } = req.body;
  if (!planId || !amount) return res.status(400).json({ error: 'planId and amount are required.' });
  const investAmount = parseFloat(amount);
  if (isNaN(investAmount) || investAmount <= 0) return res.status(400).json({ error: 'Invalid amount.' });

  const { data: user, error: userError } = await supabase.from('users').select('id, balance').eq('id', req.session.userId).single();
  if (userError || !user) return res.status(404).json({ error: 'User not found.' });
  if (Number(user.balance) < investAmount) return res.status(400).json({ error: 'Insufficient balance.' });

  const newBalance = Number(user.balance) - investAmount;
  const { error: balanceError } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
  if (balanceError) return res.status(500).json({ error: balanceError.message });

  const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).single();
  if (!plan) return res.status(404).json({ error: 'Plan not found.' });

  await supabase.from('investments').insert({ user_id: user.id, plan_id: plan.id, plan_name: plan.name, amount: investAmount, daily_profit: plan.daily_profit, duration: plan.duration, status: 'active' });
  await supabase.from('transactions').insert({ user_id: user.id, type: 'investment', amount: investAmount, status: 'completed', description: `Investment in ${plan.name}` });

  res.json({ success: true, message: 'Investment created successfully.' });
});

app.get('/api/my-investment', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('investments').select('*').eq('user_id', req.session.userId).eq('status', 'active').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/my-plans', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('investments').select('*').eq('user_id', req.session.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/portfolio', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const [userResult, walletResult, prices] = await Promise.all([
      supabase.from('users').select('balance').eq('id', req.session.userId).single(),
      supabase.from('wallets').select('*').eq('user_id', req.session.userId).single(),
      getCoinPrices(),
    ]);
    if (userResult.error) throw userResult.error;
    res.json({ balance: Number(userResult.data?.balance || 0), wallet: walletResult.data, prices });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/wallet', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', req.session.userId).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── SWAP ──────────────────────────────────────────────────────────────────────
app.get('/api/swap/prices', async (req, res) => {
  try {
    const prices = await getCoinPrices();
    res.json(prices);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/swap', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { from, to, amount } = req.body;
    const usdValue = Number(amount);
    if (!from || !to || usdValue <= 0) return res.status(400).json({ error: 'Invalid swap parameters.' });

    const prices = await getCoinPrices();
    const feeRate = 0.005;
    const fee = usdValue * feeRate;
    const afterFee = usdValue - fee;

    const [userRes, walletRes] = await Promise.all([
  supabase
    .from('users')
    .select('balance')
    .eq('id', req.session.userId)
    .maybeSingle(),

  supabase
    .from('wallets')
    .select('*')
    .eq('user_id', req.session.userId)
    .maybeSingle(),
]);
    if (userRes.error) throw userRes.error;
    if (walletRes.error) throw walletRes.error;

    let userBalance = Number(userRes.data.balance);
    let wallet = { ...walletRes.data };
    let receive = 0;

    if (from === 'balance') {
      if (userBalance < usdValue) return res.status(400).json({ error: 'Insufficient main balance.' });
      userBalance -= usdValue;
      receive = afterFee / prices[to];
      wallet[to] = (wallet[to] || 0) + receive;
    } else if (to === 'balance') {
      const coinBalance = wallet[from] || 0;
      const coinUsdValue = coinBalance * prices[from];
      if (coinUsdValue < usdValue) return res.status(400).json({ error: `Insufficient ${from.toUpperCase()} balance.` });
      const coinDeducted = usdValue / prices[from];
      wallet[from] = coinBalance - coinDeducted;
      receive = afterFee;
      userBalance += receive;
    } else {
      const coinBalance = wallet[from] || 0;
      const coinUsdValue = coinBalance * prices[from];
      if (coinUsdValue < usdValue) return res.status(400).json({ error: `Insufficient ${from.toUpperCase()} balance.` });
      const coinDeducted = usdValue / prices[from];
      wallet[from] = coinBalance - coinDeducted;
      receive = afterFee / prices[to];
      wallet[to] = (wallet[to] || 0) + receive;
    }

    await supabase.from('users').update({ balance: userBalance }).eq('id', req.session.userId);
    await supabase.from('wallets').update(wallet).eq('user_id', req.session.userId);
    await supabase.from('transactions').insert({
      user_id: req.session.userId, type: 'swap', amount: usdValue,
      status: 'completed',
      description: `Swap ${from.toUpperCase()} → ${to.toUpperCase()} ($${usdValue.toFixed(2)})`,
    });

    await logActivity(req.session.userId, 'swap', { from, to, amount: usdValue, fee });
    await createNotification(req.session.userId, 'swap', 'Swap Completed',
      `Swapped $${usdValue.toFixed(2)} from ${from.toUpperCase()} to ${to.toUpperCase()}`,
      { from, to, amount: usdValue, fee, status: 'completed' }
    );

    // Email user
    const { data: user } = await supabase.from('users').select('name, email').eq('id', req.session.userId).single();
    if (user) {
      await sendEmail({
        to: user.email,
        subject: 'Swap Completed – ChainFinex',
        html: emailTemplate('Swap Completed', `
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>Your crypto swap has been completed successfully.</p>
          <div class="info-box">
            <div class="info-row"><span class="label">From</span><span class="value">${from.toUpperCase()}</span></div>
            <div class="info-row"><span class="label">To</span><span class="value">${to.toUpperCase()}</span></div>
            <div class="info-row"><span class="label">Amount</span><span class="value">$${usdValue.toFixed(2)}</span></div>
            <div class="info-row"><span class="label">Fee</span><span class="value">$${fee.toFixed(4)}</span></div>
            <div class="info-row"><span class="label">Status</span><span class="value status-completed">Completed</span></div>
          </div>
        `),
      });
    }

    const { data: updatedUser } = await supabase.from('users').select('balance').eq('id', req.session.userId).single();
    res.json({ success: true, fee: fee, received: receive, wallet, balance: updatedUser.balance });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('users').select('id, name, email, role, balance, created_at, country, phone').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/users/:id/activity', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const [logsRes, txRes, depositsRes, withdrawalsRes] = await Promise.all([
    supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('pending_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  res.json({
    activity: logsRes.data || [],
    transactions: txRes.data || [],
    deposits: depositsRes.data || [],
    withdrawals: withdrawalsRes.data || [],
  });
});

app.patch('/api/admin/users/:id/balance', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { action, amount } = req.body;
  if (!action || amount === undefined) return res.status(400).json({ error: 'action and amount required' });

  const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', id).single();
  if (userError || !user) return res.status(404).json({ error: 'User not found' });

  const prev = parseFloat(user.balance);
  const amt = parseFloat(amount);
  let next;
  if (action === 'set') next = amt;
  else if (action === 'increase') next = prev + amt;
  else if (action === 'decrease') next = Math.max(0, prev - amt);
  else return res.status(400).json({ error: 'action must be set|increase|decrease' });

  const { data: updatedUser, error } = await supabase.from('users').update({ balance: next }).eq('id', id).select('id, name, email, role, balance').single();
  if (error) return res.status(500).json({ error: error.message });

  const transactionType = action === 'increase' ? 'deposit' : action === 'decrease' ? 'withdrawal' : 'balance_update';
  await supabase.from('transactions').insert({ user_id: id, type: transactionType, amount: amt, status: 'completed', description: action === 'set' ? 'Balance set by admin' : action === 'increase' ? 'Account funded by admin' : 'Balance adjusted by admin' });
  await logActivity(id, action === 'increase' ? 'balance_increase' : action === 'decrease' ? 'balance_decrease' : 'balance_set', { previousBalance: prev.toFixed(2), newBalance: next.toFixed(2), amount: amt.toFixed(2), adminId: req.adminUser.id, adminName: req.adminUser.name });

  res.json(updatedUser);
});

app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('activity_logs').select('id, type, metadata, created_at, user_id, users(name,email)').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(l => ({
    id: l.id, type: l.type, metadata: safeJson(l.metadata), createdAt: l.created_at,
    userId: l.user_id, userName: l.users?.name || 'Unknown', userEmail: l.users?.email || '',
  })));
});

app.put('/api/admin/payment-addresses', requireAdmin, async (req, res) => {
  const { coins = [] } = req.body;
  for (const coin of coins) {
    const { type, address = '', label = '' } = coin;
    const { data: existing } = await supabase.from('payment_addresses').select('id').eq('type', type).single();
    if (existing) { await supabase.from('payment_addresses').update({ address, label }).eq('type', type); }
    else { await supabase.from('payment_addresses').insert({ type, address, label }); }
  }
  const { data, error } = await supabase.from('payment_addresses').select('*').order('type');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/investments', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('investments').select('*, users(name,email)').in('status', ['active', 'completed']).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(inv => {
    let totalDays = 0;
    if (inv.duration?.includes('Week')) totalDays = parseInt(inv.duration) * 7;
    else if (inv.duration?.includes('Month')) totalDays = parseInt(inv.duration) * 30;
    else totalDays = parseInt(inv.duration) || 0;
    return { ...inv, total_days: totalDays };
  }));
});

app.post('/api/admin/investments/:id/pay', requireAdmin, async (req, res) => {
  const investmentId = parseInt(req.params.id);
  const { data: investment, error: investmentError } = await supabase.from('investments').select('*').eq('id', investmentId).single();
  if (investmentError || !investment) return res.status(404).json({ error: 'Investment not found.' });
  if (investment.status !== 'active') return res.status(400).json({ error: 'Investment is already completed.' });

  const today = new Date().toISOString().split('T')[0];
  if (investment.last_paid_date === today) return res.status(400).json({ error: "Today's profit has already been paid." });

  if (investment.days_paid >= investment.duration) {
    await supabase.from('investments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', investment.id);
    return res.status(400).json({ error: 'Investment has already finished.' });
  }

  // Admin can supply a custom percentage (2–40); fall back to plan's daily_profit
  const rawPct = req.body.percentage !== undefined ? Number(req.body.percentage) : Number(investment.daily_profit);
  const percentage = Math.min(Math.max(rawPct, 0), 100);
  const profit = Number(investment.amount) * percentage / 100;
  const { data: user } = await supabase.from('users').select('id, balance').eq('id', investment.user_id).single();
  const newBalance = Number(user.balance) + profit;

  await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
  const newDaysPaid = (investment.days_paid || 0) + 1;
  const newTotalProfit = Number(investment.total_profit || 0) + profit;
  let updateData = { days_paid: newDaysPaid, total_profit: newTotalProfit, last_paid_date: today };
  if (newDaysPaid >= parseInt(investment.duration)) updateData.status = 'completed';

  await supabase.from('investments').update(updateData).eq('id', investment.id);
  await supabase.from('transactions').insert({ user_id: investment.user_id, type: 'profit', amount: profit, status: 'completed', description: `Daily profit from ${investment.plan_name}` });
  await createNotification(investment.user_id, 'profit', 'Profit Paid',
    `Daily profit of $${profit.toFixed(2)} from ${investment.plan_name} has been added to your balance.`,
    { investmentId, amount: profit, planName: investment.plan_name }
  );
  res.json({ success: true, profit, newBalance });
});

app.post('/api/admin/investments/:id/end', requireAdmin, async (req, res) => {
  const investmentId = parseInt(req.params.id);
  const { data: investment } = await supabase.from('investments').select('*').eq('id', investmentId).single();
  if (!investment) return res.status(404).json({ error: 'Investment not found.' });
  await supabase.from('investments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', investmentId);
  res.json({ success: true });
});

// ── MANAGED ACCOUNTS ─────────────────────────────────────────────────────────

// GET /api/managed-account/plans
app.get('/api/managed-account/plans', async (req, res) => {
  const { data, error } = await supabase
    .from('managed_account_plans')
    .select('*')
    .eq('active', true)
    .order('price', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/managed-account/mine  (authenticated user)
app.get('/api/managed-account/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('managed_account_subscriptions')
    .select('*, managed_account_plans(name, price)')
    .eq('user_id', req.session.userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(204).end();
  // flatten plan info
  res.json({
    ...data,
    plan_name:  data.managed_account_plans?.name  || data.plan_name,
    plan_price: data.managed_account_plans?.price || data.plan_price,
  });
});

// POST /api/managed-account/subscribe
app.post('/api/managed-account/subscribe', requireAuth, async (req, res) => {
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required.' });

  // Check for existing active subscription
  const { data: existing } = await supabase
    .from('managed_account_subscriptions')
    .select('id')
    .eq('user_id', req.session.userId)
    .not('status', 'eq', 'cancelled')
    .limit(1)
    .maybeSingle();
  if (existing) return res.status(400).json({ error: 'You already have an active managed account subscription.' });

  // Resolve plan — accept numeric id or name string
  let planData = null;
  const numericId = parseInt(planId, 10);
  if (!isNaN(numericId)) {
    const { data } = await supabase.from('managed_account_plans').select('*').eq('id', numericId).maybeSingle();
    planData = data;
  }
  if (!planData) {
    const { data } = await supabase.from('managed_account_plans').select('*').ilike('name', String(planId)).maybeSingle();
    planData = data;
  }

  // If plan not found in DB, use defaults (matching the frontend DEFAULT_PLANS)
  const DEFAULT_PLANS = { Basic: 49, Standard: 149, Premium: 349, Enterprise: 999 };
  let planName = planData?.name  || String(planId);
  let planPrice = planData?.price || DEFAULT_PLANS[planName] || 0;

  const { data: user } = await supabase
  .from("users")
  .select("balance")
  .eq("id", req.session.userId)
  .single();

if (!user) {
  return res.status(404).json({ error: "User not found." });
}

if (Number(user.balance) < Number(planPrice)) {
  return res.status(400).json({
    error: "Insufficient Main Balance."
  });
}

const newBalance = Number(user.balance) - Number(planPrice);

const { error: balanceError } = await supabase
  .from("users")
  .update({
    balance: newBalance
  })
  .eq("id", req.session.userId);

if (balanceError) {
  return res.status(500).json({
    error: balanceError.message
  });
}

const { data: sub, error } = await supabase
.from("managed_account_subscriptions")
.insert({
    user_id: req.session.userId,
    plan_id: planData?.id || null,
    plan_name: planName,
    plan_price: planPrice,
    status: "active",
    subscribed_at: new Date().toISOString(),
})
.select()
.single();

if (error) {

// Roll back the deducted balance
await supabase
    .from("users")
    .update({
        balance: user.balance
    })
    .eq("id", req.session.userId);

return res.status(500).json({
    error: error.message
});

}

  // Notify admin
  await createNotification(
    req.session.userId, 'managed_account', 'Managed Account Subscribed',
    `You have subscribed to the ${planName} managed account plan at $${planPrice}/mo.`,
    { planName, planPrice }
  );

  res.json({ success: true, subscription: sub, balance: newBalance });
});

// POST /api/managed-account/cancel
app.post('/api/managed-account/cancel', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('managed_account_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('user_id', req.session.userId)
    .neq('status', 'cancelled');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/admin/managed-accounts
app.get('/api/admin/managed-accounts', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('managed_account_subscriptions')
    .select('*, users(name, email, balance)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// PUT /api/admin/managed-accounts/:id
app.put('/api/admin/managed-accounts/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, admin_notes } = req.body;
  const updateFields = {};
  if (status)       updateFields.status      = status;
  if (admin_notes !== undefined) updateFields.admin_notes = admin_notes;
  const { data, error } = await supabase
    .from('managed_account_subscriptions')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  // Notify user if status changed
  if (status && data) {
    await createNotification(
      data.user_id, 'managed_account', 'Managed Account Update',
      `Your managed account status has been updated to: ${status}.`,
      { status }
    );
  }
  res.json({ success: true, data });
});

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── STATIC + SPA FALLBACK ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── START ─────────────────────────────────────────────────────────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n🚀 ChainFinex running at http://localhost:${PORT}`);
  });
}

module.exports = app;
