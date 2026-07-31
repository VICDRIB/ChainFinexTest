import api from '../api.js';
import { timeAgo, navigate } from '../app.js';

const TYPE_ICON = {
  login: '🔑',
  deposit: '💳',
  withdrawal: '💸',
  swap: '🔄',
  profit: '📈',
  profile: '👤',
  security: '🔒',
  new_user: '✨',
  user_login: '🔑',
  admin_deposit: '💰',
  admin_withdrawal: '🏦',
  default: '🔔',
};

const STATUS_BADGE = {
  pending: '<span class="notif-status pending">Pending</span>',
  approved: '<span class="notif-status approved">Approved</span>',
  completed: '<span class="notif-status approved">Completed</span>',
  declined: '<span class="notif-status declined">Declined</span>',
  rejected: '<span class="notif-status declined">Rejected</span>',
};

export async function render(container) {
  container.innerHTML = `
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">All your account activity and alerts.</p>
        </div>
        <button class="btn" id="markAllReadBtn">Mark all read</button>
      </div>
      <div id="notif-list"><div class="loading-spinner-wrap"><div class="spinner"></div></div></div>
    </div>
  `;

  document.getElementById('markAllReadBtn').onclick = async () => {
    await api.markAllNotificationsRead();
    await load();
  };

  await load();
}

async function load() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  try {
    const notifications = await api.notifications();

    if (!notifications.length) {
      list.innerHTML = `
        <div class="card card-body" style="text-align:center;padding:60px 24px;">
          <div style="font-size:48px;margin-bottom:16px;">🔔</div>
          <h3 style="color:#0f172a;margin-bottom:8px;">No notifications yet</h3>
          <p style="color:#64748b;font-size:14px;">Activity on your account will appear here.</p>
        </div>
      `;
      return;
    }

    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);

    let html = '';

    if (unread.length) {
      html += `<div class="notif-section-label">New (${unread.length})</div>`;
      html += unread.map(n => renderNotif(n, false)).join('');
    }

    if (read.length) {
      html += `<div class="notif-section-label" style="margin-top:20px;">Earlier</div>`;
      html += read.map(n => renderNotif(n, true)).join('');
    }

    list.innerHTML = `<div class="notif-feed">${html}</div>`;

    list.querySelectorAll('.notif-item[data-id]').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        if (!item.classList.contains('read')) {
          item.classList.add('read');
          await api.markNotificationRead(id);
        }
        // Navigate based on type
        const type = item.dataset.type;
        if (type === 'deposit' || type === 'admin_deposit') navigate('/deposits');
        else if (type === 'withdrawal' || type === 'admin_withdrawal') navigate('/withdrawals');
        else if (type === 'swap') navigate('/transactions');
        else if (type === 'profit') navigate('/my-plans');
        else if (type === 'profile') navigate('/profile');
        else if (type === 'security') navigate('/security');
        else if (type === 'user_login' || type === 'new_user') navigate('/admin/activity');
      });
    });
  } catch (err) {
    list.innerHTML = `<div style="color:#ef4444;text-align:center;padding:24px;">${err.message}</div>`;
  }
}

function renderNotif(n, isRead) {
  const icon = TYPE_ICON[n.type] || TYPE_ICON.default;
  const data = n.data || {};
  const status = data.status ? (STATUS_BADGE[data.status] || '') : '';
  return `
    <div class="notif-item ${isRead ? 'read' : 'unread'}" data-id="${n.id}" data-type="${n.type}">
      <div class="notif-icon-wrap">${icon}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-message">${n.message || ''} ${status}</div>
        ${data.reason ? `<div class="notif-reason">Reason: ${data.reason}</div>` : ''}
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
      ${!isRead ? '<div class="notif-dot"></div>' : ''}
    </div>
  `;
}
