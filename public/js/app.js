import api from './api.js';
import { t, initI18n, setLanguage, getCurrentLang, SUPPORTED_LANGUAGES } from './translations.js';

// ── AUTH STATE ────────────────────────────────────────────────────────────────
export let currentUser = null;

// ── TOAST ─────────────────────────────────────────────────────────────────────
export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeInRight 0.2s ease-out reverse forwards';
    setTimeout(() => el.remove(), 200);
  }, 3500);
}

// ── TIME HELPERS ──────────────────────────────────────────────────────────────
export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function formatCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
}

export function formatBigNum(v) {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Number(v).toLocaleString()}`;
}

// ── PAGE FOOTER ───────────────────────────────────────────────────────────────
export function renderFooter(container) {
  // Remove existing footer
  const existing = container.querySelector('.page-footer');
  if (existing) existing.remove();
  const footer = document.createElement('div');
  footer.className = 'page-footer';
  footer.textContent = t('footer');
  container.appendChild(footer);
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const BASE_NAV = [
  { label: 'dashboard',    href: '/dashboard',        icon: '⊞',  key: 'dashboard' },
  { label: 'crypto_market',href: '/crypto',            icon: '📈', key: 'crypto_market' },
  { label: 'deposit',      href: '/payments',          icon: '💳', key: 'deposit' },
  { label: 'Swap Crypto',     href: '/swap',          icon: '🔄', key: 'Swap Crypto' },
  { label: 'Investment Plans',     href: '/trading-plans', icon: '📊', key: 'Investment Plans' },
  { label: 'my_plans',     href: '/my-plans',          icon: '📦', key: 'my_plans' },
  { label: 'withdraw',     href: '/withdraw',          icon: '💸', key: 'withdraw' },
  { label: 'notifications',href: '/notifications',     icon: '🔔', key: 'notifications' },
  { label: 'profile',      href: '/profile',           icon: '👤', key: 'profile' },
  { label: 'managed_account', href: '/managed-account', icon: '🏦', key: 'managed_account' },
];

const ADMIN_NAV = [
  { label: 'users',            href: '/admin',                     icon: '👥', key: 'users' },
  { label: 'activity_log',     href: '/admin/activity',            icon: '📋', key: 'activity_log' },
  { label: 'payment_addresses',href: '/admin/payment-addresses',   icon: '👛', key: 'payment_addresses' },
  { label: 'pending_deposits', href: '/admin/pending-payments',    icon: '💰', key: 'pending_deposits' },
  { label: 'withdrawals',      href: '/admin/withdrawals',         icon: '💸', key: 'withdrawals' },
  { label: 'members',          href: '/members',                   icon: '👤', key: 'members' },
  { label: 'investments',      href: '/admin/investments',         icon: '📊', key: 'investments' },
  { label: 'manage_accounts',  href: '/admin/managed-accounts',    icon: '🏦', key: 'manage_accounts' },
];

function getUserNav() { return BASE_NAV; }
function getAdminNav() { return ADMIN_NAV; }

export function currentPath() {
  return window.location.pathname || '/';
}

function isActive(href) {
  const p = currentPath();
  if (href === '/dashboard') return p === '/' || p === '/dashboard';
  return p === href || (href !== '/' && p.startsWith(href));
}

function initials(name) {
  return (name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColors() {
  return ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
}

function userAvatarColor(id) {
  return avatarColors()[id % avatarColors().length];
}

function renderNavLinks(containerId, items, showAdminSection = false, onNav) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = '';
  items.forEach((item, i) => {
    const active = isActive(item.href) ? 'active' : '';
    const notifBadge = item.href === '/notifications'
      ? `<span class="nav-notif-badge hidden" id="nav-notif-badge-${containerId}"></span>` : '';
    html += `<button class="nav-link ${active}" data-href="${item.href}">
      <span class="nav-icon">${item.icon}</span>
      ${t(item.key) || item.label}
      ${notifBadge}
    </button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onNav) onNav();
      navigate(btn.dataset.href);
    });
  });
}

function renderAdminNav(containerId, onNav) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = `<div class="nav-section-label">${t('admin_section')}</div>`;
  ADMIN_NAV.forEach(item => {
    const active = isActive(item.href) ? 'active' : '';
    html += `<button class="nav-link ${active}" data-href="${item.href}">
      <span class="nav-icon">${item.icon}</span>
      ${t(item.key) || item.label}
    </button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onNav) onNav();
      navigate(btn.dataset.href);
    });
  });
}

function renderSidebarUser(containerId) {
  const el = document.getElementById(containerId);
  if (!el || !currentUser) return;
  const color = userAvatarColor(currentUser.id);
  const avatarHtml = currentUser.avatarUrl
    ? `<img src="${currentUser.avatarUrl}" alt="${currentUser.name}">`
    : initials(currentUser.name);
  const badge = currentUser.role === 'admin'
    ? `<div class="user-badge badge-admin">Admin</div>`
    : `<div class="user-badge badge-user">🟢 Online</div>`;
  el.innerHTML = `
    <div class="user-avatar" style="background:${color};" id="sidebar-avatar-${containerId}">${avatarHtml}</div>
    <div class="user-info">
      <div class="user-name">${currentUser.name}</div>
      ${badge}
    </div>
    <button class="logout-btn" title="${t('logout')}" id="logout-btn-${containerId}">↪</button>
  `;
  el.querySelector(`#logout-btn-${containerId}`).addEventListener('click', async () => {
    await api.logout();
    location.reload();
  });
  el.querySelector(`#sidebar-avatar-${containerId}`)?.addEventListener('click', openProfileDrawer);
}

function renderShell() {
  const isAdmin = currentUser?.role === 'admin';

  if (isAdmin) {
    // Admin: show admin nav in main desktop sidebar
    renderAdminNav('sidebar-nav');
    renderAdminNav('admin-mobile-nav', closeAdminDrawer);
    renderSidebarUser('sidebar-user');
    renderSidebarUser('admin-mobile-user');
    renderSidebarUser('mobile-user');
  } else {
    // User: show user nav
    renderNavLinks('sidebar-nav', getUserNav());
    renderNavLinks('mobile-nav', getUserNav(), false, closeMobileDrawer);
    renderSidebarUser('sidebar-user');
    renderSidebarUser('mobile-user');
  }

  renderDesktopUser();
  updateNotifBadge();
}

function renderDesktopUser() {
  const el = document.getElementById('desktop-user');
  const mobileEl = document.getElementById('mobile-header-user');
  if (!currentUser) return;
  const color = userAvatarColor(currentUser.id);
  const avatarHtml = currentUser.avatarUrl
    ? `<img src="${currentUser.avatarUrl}" alt="${currentUser.name}">`
    : initials(currentUser.name);
  const html = `<div class="header-avatar" style="background:${color};" id="header-avatar-btn">${avatarHtml}</div>`;
  if (el) {
    el.innerHTML = html;
    el.querySelector('#header-avatar-btn')?.addEventListener('click', openProfileDrawer);
  }
  if (mobileEl) {
    mobileEl.innerHTML = html.replace('header-avatar-btn', 'header-avatar-btn-mobile');
    mobileEl.querySelector('#header-avatar-btn-mobile')?.addEventListener('click', openProfileDrawer);
  }
}

// ── NOTIFICATION BADGE ────────────────────────────────────────────────────────
async function updateNotifBadge() {
  try {
    const { count } = await api.unreadCount();
    ['sidebar-nav', 'mobile-nav'].forEach(containerId => {
      const badge = document.getElementById(`nav-notif-badge-${containerId}`);
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    });
  } catch {}
}

// ── LANGUAGE SWITCHER ─────────────────────────────────────────────────────────
function initLangSwitcher() {
  function buildDropdown(dropdownId, btnId, flagId, nameId) {
    const dropdown = document.getElementById(dropdownId);
    const btn = document.getElementById(btnId);
    const flag = document.getElementById(flagId);
    const name = document.getElementById(nameId);
    if (!dropdown || !btn) return;

    const updateBtn = () => {
      const lang = getCurrentLang();
      const info = SUPPORTED_LANGUAGES[lang];
      if (flag) flag.textContent = info.flag;
      if (name) name.textContent = lang.toUpperCase();
    };
    updateBtn();

    const buildItems = () => {
      dropdown.innerHTML = Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => `
        <div class="lang-option ${getCurrentLang() === code ? 'active' : ''}" data-lang="${code}">
          <span class="lang-flag">${info.flag}</span>
          <span>${info.name}</span>
        </div>
      `).join('');
      dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
          setLanguage(opt.dataset.lang);
          dropdown.classList.add('hidden');
          updateBtn();
          // Re-render shell nav with new translations
          renderShell();
        });
      });
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      buildItems();
      dropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target)) dropdown.classList.add('hidden');
    });
  }

  buildDropdown('lang-dropdown', 'lang-btn', 'lang-flag', 'lang-name');
  buildDropdown('mobile-lang-dropdown', 'mobile-lang-btn', 'mobile-lang-flag', null);

  // Re-render shell on language change
  document.addEventListener('langchange', () => {
    renderShell();
    // Update footer
    document.querySelectorAll('.page-footer').forEach(f => { f.textContent = t('footer'); });
  });
}

// ── PROFILE DRAWER ────────────────────────────────────────────────────────────
export async function openProfileDrawer() {
  if (!currentUser) return;
  const overlay = document.getElementById('profileDrawerOverlay');
  const drawer = document.getElementById('profileDrawer');
  const nameEl = document.getElementById('drawerName');
  const balEl = document.getElementById('drawerBalance');
  const menu = document.getElementById('drawerMenu');
  if (nameEl) nameEl.textContent = currentUser.name;
  const portfolio = await api.portfolio();

let totalPortfolio = Number(portfolio.balance);

Object.keys(portfolio.prices).forEach(symbol => {
    totalPortfolio +=
        (Number(portfolio.wallet[symbol] || 0)) *
        Number(portfolio.prices[symbol] || 0);
});

if (balEl) {
    balEl.textContent = formatCurrency(totalPortfolio);
}
  if (menu) {
    menu.innerHTML = `
      <div class="drawer-item" onclick="window._navTo('/profile')" style="cursor:pointer;">
        <span>👤 Profile</span><span style="color:#94a3b8;">›</span>
      </div>
      <div class="drawer-item" onclick="window._navTo('/security')" style="cursor:pointer;">
        <span>🔒 Security</span><span style="color:#94a3b8;">›</span>
      </div>
      <div class="drawer-item" onclick="window._navTo('/transactions')" style="cursor:pointer;">
        <span>📋 Transactions</span><span style="color:#94a3b8;">›</span>
      </div>
      <div class="drawer-item" onclick="window._navTo('/referral')" style="cursor:pointer;">
        <span>🎁 Referral</span><span style="color:#94a3b8;">›</span>
      </div>
      <div style="padding:20px 0 0;">
        <button class="btn btn-danger btn-w100" id="drawer-logout-btn">↪ ${t('logout')}</button>
      </div>
    `;
    document.getElementById('drawer-logout-btn')?.addEventListener('click', async () => {
      await api.logout();
      location.reload();
    });
  }
  if (overlay) overlay.classList.remove('hidden');
  if (drawer) drawer.classList.add('open');
}

window._navTo = (path) => { closeProfileDrawer(); navigate(path); };

export function closeProfileDrawer() {
  document.getElementById('profileDrawerOverlay')?.classList.add('hidden');
  document.getElementById('profileDrawer')?.classList.remove('open');
}

window.closeProfileDrawer = closeProfileDrawer;

document.getElementById('profileDrawerOverlay')?.addEventListener('click', closeProfileDrawer);

// ── MOBILE DRAWER ─────────────────────────────────────────────────────────────
window.closeMobileDrawer = function () {

  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.getElementById("drawer-backdrop");

  drawer.classList.remove("open");
  backdrop.classList.remove("open");

  setTimeout(() => {
      drawer.classList.add("hidden");
      backdrop.classList.add("hidden");
  }, 300);

  document.querySelector(".mobile-header")
      ?.classList.remove("hidden");
}

window.closeAdminDrawer = function () {

  const drawer = document.getElementById("admin-mobile-drawer");
  const backdrop = document.getElementById("drawer-backdrop");

  drawer.classList.remove("open");
  backdrop.classList.remove("open");

  setTimeout(() => {
      drawer.classList.add("hidden");
      backdrop.classList.add("hidden");
  }, 300);

  document.querySelector(".mobile-header")
      ?.classList.remove("hidden");
}

function openMobileDrawer() {

  const drawer = currentUser?.role === "admin"
      ? document.getElementById("admin-mobile-drawer")
      : document.getElementById("mobile-drawer");

  const backdrop = document.getElementById("drawer-backdrop");

  drawer.classList.remove("hidden");
  backdrop.classList.remove("hidden");

  requestAnimationFrame(() => {
      drawer.classList.add("open");
      backdrop.classList.add("open");
  });

  //document.querySelector(".mobile-header")
    //  ?.classList.add("hidden");
}
  
  //else{

    //  const drawer=document.getElementById("mobile-drawer");

      //drawer.classList.remove("hidden");
      //drawer.classList.add("open");

  //}

//}

// ── LOAD PROFILE PICTURE ──────────────────────────────────────────────────────
function loadProfilePicture() {
  if (!currentUser?.avatarUrl) return;
  // Already handled by renderShell
}

// ── ROUTER ────────────────────────────────────────────────────────────────────
const routes = [];

function registerRoute(pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '(?:/)?$');
  routes.push({ regex, keys, handler });
}

export function navigate(path) {
  window.history.pushState({}, '', path);
  loadPage(path);
  window.scrollTo(0, 0);
}

window.navigate = navigate;

window.addEventListener('popstate', () => loadPage(currentPath()));

async function loadPage(path) {
  const container = document.getElementById('page-content');
  if (!container) return;
  container.innerHTML = `<div class="page-inner"><div class="loading-spinner-wrap"><div class="spinner"></div></div></div>`;

  // Update active nav
  document.querySelectorAll('.nav-link').forEach(btn => {
    const href = btn.dataset.href;
    const active = href === '/dashboard'
      ? (path === '/' || path === '/dashboard')
      : (path === href || (href && href !== '/' && path.startsWith(href)));
    btn.classList.toggle('active', !!active);
  });

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.keys.forEach((k, i) => { params[k] = match[i + 1]; });
      try {
        container.classList.remove('page-enter');
        void container.offsetWidth;
        container.classList.add('page-enter');
        await route.handler(container, params);
        renderFooter(container);
        updateNotifBadge();
      } catch (err) {
        container.innerHTML = `<div class="page-inner"><div class="card card-body" style="text-align:center;padding:40px;"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><h3 style="color:#ef4444;margin-bottom:8px;">Something went wrong</h3><p style="color:#64748b;">${err.message}</p></div></div>`;
        renderFooter(container);
      }
      return;
    }
  }

  container.innerHTML = `<div class="page-inner"><div class="card card-body" style="text-align:center;padding:60px;"><div style="font-size:56px;margin-bottom:16px;">🔍</div><h3 style="margin-bottom:8px;">Page not found</h3><p style="color:#64748b;margin-bottom:20px;">The page you're looking for doesn't exist.</p><button class="btn btn-primary" onclick="navigate('/dashboard')">Back to Dashboard</button></div></div>`;
  renderFooter(container);
}

// ── AUTH PAGES ────────────────────────────────────────────────────────────────
function showAuthPage(page) {
  document.getElementById('auth-root').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  if (page === 'register') {
    import('./pages/register.js').then(m => m.renderRegister(document.getElementById('auth-root')));
  } else if (page === 'forgot-password') {
    import('./pages/forgot-password.js').then(m => m.renderForgotPassword(document.getElementById('auth-root')));
  } else {
    import('./pages/login.js').then(m => m.renderLogin(document.getElementById('auth-root')));
  }
}

function showApp() {
  document.getElementById('auth-root').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
}

export function onLoginSuccess(user) {
  currentUser = user;
  showApp();
  renderShell();
  const dest = user.role === 'admin' ? '/admin' : '/dashboard';
  window.history.replaceState({}, '', dest);
  loadPage(dest);
}

export function goToRegister() { showAuthPage('register'); }
export function goToLogin() { showAuthPage('login'); }
export function goToForgotPassword() { showAuthPage('forgot-password'); }

// ── INIT ──────────────────────────────────────────────────────────────────────
(async () => {
  // Init i18n first
  initI18n();

  // Setup sidebar toggle
  document.getElementById('sidebarToggle2')?.addEventListener('click', openMobileDrawer);
    //const sidebar = document.getElementById('sidebar');
    //if (sidebar) sidebar.style.display = sidebar.style.display === 'none' ? '' : 'none';
    //openMobileDrawer();
  //});

  // Init language switcher
  initLangSwitcher();

  // Register routes
  const routeMap = {
    '/':                  () => import('./pages/dashboard.js'),
    '/portfolio':         () => import('./pages/portfolio.js'),
    '/profit-history':    () => import('./pages/profit-history.js'),
    '/bonus':             () => import('./pages/bonus.js'),
    '/dashboard':         () => import('./pages/dashboard.js'),
    '/withdraw':          () => import('./pages/withdraw.js'),
    '/withdrawals':       () => import('./pages/withdrawals.js'),
    '/deposits':          () => import('./pages/deposits.js'),
    '/notifications':     () => import('./pages/notifications.js'),
    '/crypto':            () => import('./pages/crypto.js'),
    '/crypto/:coinId':    () => import('./pages/crypto-detail.js'),
    '/payments':          () => import('./pages/payments.js'),
    '/referral':          () => import('./pages/referral.js'),
    '/referral-bonus':    () => import('./pages/referralBonus.js'),
    '/trading-plans':     () => import('./pages/trading-plans.js'),
    '/my-plans':          () => import('./pages/my-plans.js'),
    '/members':           () => import('./pages/members.js'),
    '/profile':           () => import('./pages/profile.js'),
    '/transactions':      () => import('./pages/transactions.js'),
    '/swap':              () => import('./pages/swap.js'),
    '/security':          () => import('./pages/security.js'),
    '/managed-account':   () => import('./pages/managed-account.js'),
    '/managed-account/subscribe': () => import('./pages/subscription-plans.js'),
    '/admin':             () => import('./pages/admin-users.js'),
    '/admin/investments': () => import('./pages/admin-investments.js'),
    '/admin/activity':    () => import('./pages/admin-activity.js'),
    '/admin/payment-addresses':  () => import('./pages/admin-payment-addresses.js'),
    '/admin/pending-payments':   () => import('./pages/admin-pending-payments.js'),
    '/admin/withdrawals':        () => import('./pages/admin-withdrawals.js'),
    '/admin/managed-accounts':   () => import('./pages/admin-managed-accounts.js'),
  };

  for (const [path, loader] of Object.entries(routeMap)) {
    registerRoute(path, async (container, params) => {
      const mod = await loader();
      await mod.render(container, params);
    });
  }

  try {
    currentUser = await api.me();
  } catch {
    currentUser = null;
  }

  const path = currentPath();
  const authPaths = ['/login', '/register'];

  if (!currentUser) {
    const page = path === '/register' ? 'register' : 'login';
    showAuthPage(page);
  } else {
    showApp();
    renderShell();
    loadProfilePicture();
    const dest = authPaths.includes(path) ? (currentUser.role === 'admin' ? '/admin' : '/dashboard') : path;
    window.history.replaceState({}, '', dest);
    await loadPage(dest);

    // Poll for notifications every 60s
    setInterval(updateNotifBadge, 60000);
  }
})();
