// ── API CLIENT ────────────────────────────────────────────────────────────────

async function apiFetch(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

const api = {
  // Auth
  me:       () => apiFetch('GET',  '/api/auth/me'),
  login:    (email, password) => apiFetch('POST', '/api/auth/login', { email, password }),
  register: (name, email, password, referredBy) =>
    apiFetch('POST', '/api/auth/register', { name, email, password, referredBy }),
  logout:   () => apiFetch('POST', '/api/auth/logout'),

  // Forgot / Reset Login Password (public)
  forgotPassword:  (email)                     => apiFetch('POST', '/api/auth/forgot-password', { email }),
  resetPassword:   (email, otp, newPassword)   => apiFetch('POST', '/api/auth/reset-password', { email, otp, newPassword }),

  // Forgot / Reset Withdrawal Password (requires session)
  forgotWithdrawPassword:  ()                  => apiFetch('POST', '/api/profile/forgot-withdraw-password'),
  resetWithdrawPassword:   (otp, newPassword)  => apiFetch('POST', '/api/profile/reset-withdraw-password', { otp, newPassword }),

  // Profile
  updateProfile:       (profile)               => apiFetch('PUT',  '/api/profile', profile),
  changePassword:      (currentPassword, newPassword) =>
    apiFetch('PUT', '/api/profile/password', { currentPassword, newPassword }),
  setWithdrawPassword: (password)              => apiFetch('PUT', '/api/profile/withdraw-password', { password }),
  changeWithdrawPassword: (currentPassword, newPassword) =>
    apiFetch('PUT', '/api/profile/change-withdraw-password', { currentPassword, newPassword }),
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/profile/avatar', {
      method: 'POST', credentials: 'include', body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  // Notifications
  notifications:          () => apiFetch('GET', '/api/notifications'),
  unreadCount:            () => apiFetch('GET', '/api/notifications/unread-count'),
  markNotificationRead:   (id) => apiFetch('PUT', `/api/notifications/${id}/read`),
  markAllNotificationsRead: () => apiFetch('PUT', '/api/notifications/read-all'),

  // Dashboard
  dashboardSummary: () => apiFetch('GET', '/api/dashboard/summary'),
  wallet:           () => apiFetch('GET', '/api/wallet'),
  myTransactions:   () => apiFetch('GET', '/api/dashboard/transactions'),

  // Crypto
  cryptoCoins:  ()             => apiFetch('GET', '/api/crypto/coins'),
  cryptoChart:  (coinId, days) => apiFetch('GET', `/api/crypto/${coinId}/chart?days=${days}`),
  swapPrices:   ()             => apiFetch('GET', '/api/swap/prices'),
  swap:         (from, to, amount) => apiFetch('POST', '/api/swap', { from, to, amount }),

  // Payments / Deposits
  paymentAddresses: ()               => apiFetch('GET',  '/api/payment-addresses'),
  submitPayment:    (amount, method) => apiFetch('POST', '/api/payments/submit', { amount, method }),
  myDeposits:       ()               => apiFetch('GET',  '/api/payments/mine'),

  // Withdrawals
  submitWithdrawal: (currency, amount, walletAddress, withdrawalPassword) =>
    apiFetch('POST', '/api/withdrawals', { currency, amount, walletAddress, withdrawalPassword }),
  myWithdrawals: () => apiFetch('GET', '/api/withdrawals'),

  // Referral
  myReferral:          ()     => apiFetch('GET',  '/api/referral'),
  transferReferralBonus: ()   => apiFetch('POST', '/api/referral/transfer'),
  referralHistory:     ()     => apiFetch('GET',  '/api/referral/history'),

  // Bonus
  bonusHistory: () => apiFetch('GET', '/api/bonus/history'),
  transferBonus: () => apiFetch('POST', '/api/bonus/transfer'),

  // Members
  members:      ()                      => apiFetch('GET',    '/api/members'),
  createMember: (name, role, email)     => apiFetch('POST',   '/api/members', { name, role, email }),
  deleteMember: (id)                    => apiFetch('DELETE', `/api/members/${id}`),

  // Plans
  getPlans:       ()              => apiFetch('GET',  '/api/plans'),
  myPlans:        ()              => apiFetch('GET',  '/api/my-plans'),
  portfolio:      ()              => apiFetch('GET',  '/api/portfolio'),
  myInvestment:   ()              => apiFetch('GET',  '/api/my-investment'),
  createInvestment: (planId, amount) => apiFetch('POST', '/api/investments', { planId, amount }),

  // Managed Accounts
  managedAccountPlans:    ()          => apiFetch('GET',  '/api/managed-account/plans'),
  myManagedAccount:       ()          => apiFetch('GET',  '/api/managed-account/mine'),
  subscribeManagedAccount: (planId)   => apiFetch('POST', '/api/managed-account/subscribe', { planId }),
  cancelManagedAccount:   ()          => apiFetch('POST', '/api/managed-account/cancel'),
  adminManagedAccounts:   ()          => apiFetch('GET',  '/api/admin/managed-accounts'),
  adminUpdateManagedAccount: (id, data) => apiFetch('PUT', `/api/admin/managed-accounts/${id}`, data),

  // Admin
  adminUsers:         ()                   => apiFetch('GET',   '/api/admin/users'),
  adminUserActivity:  (id)                 => apiFetch('GET',   `/api/admin/users/${id}/activity`),
  patchBalance:       (userId, action, amount) =>
    apiFetch('PATCH', `/api/admin/users/${userId}/balance`, { action, amount }),
  adminActivity:      ()                   => apiFetch('GET',   '/api/admin/activity'),
  savePaymentAddresses: (...coins)         => apiFetch('PUT',   '/api/admin/payment-addresses', { coins }),
  adminPendingPayments: ()                 => apiFetch('GET',   '/api/admin/pending-payments'),
  approvePendingPayment: (id, reason)      =>
    apiFetch('POST', `/api/admin/pending-payments/${id}/approve`, { reason }),
  rejectPendingPayment: (id, reason)       =>
    apiFetch('POST', `/api/admin/pending-payments/${id}/reject`, { reason }),
  adminInvestments:    ()                  => apiFetch('GET',   '/api/admin/investments'),
  payInvestment:       (id, percentage)    => apiFetch('POST',  `/api/admin/investments/${id}/pay`, { percentage }),
  endInvestment:       (id)               => apiFetch('POST',  `/api/admin/investments/${id}/end`),
  adminWithdrawals:    ()                  => apiFetch('GET',   '/api/admin/withdrawals'),
  approveWithdrawal:   (id)               => apiFetch('POST',  `/api/admin/withdrawals/${id}/approve`),
  rejectWithdrawal:    (id, reason)        =>
    apiFetch('POST', `/api/admin/withdrawals/${id}/reject`, { reason }),
};

export default api;
