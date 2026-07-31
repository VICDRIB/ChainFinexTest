import api from '../api.js';
import { toast } from '../app.js';

const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1'];

export async function render(container) {
  container.innerHTML = `<div class="page-inner">
    <div class="page-header">
      <div>
        <h1 class="page-title">Team Members</h1>
        <p class="page-subtitle">Manage users who can be assigned to tasks.</p>
      </div>
      <button class="btn btn-primary" id="add-member-btn">+ Add Member</button>
    </div>
    <div id="members-grid"></div>
  </div>
  <div class="modal-overlay" id="add-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Add Team Member</span>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <form id="member-form">
        <div class="form-row"><label class="input-label">Full Name *</label><input class="input-field" id="m-name" placeholder="Jane Doe" required /></div>
        <div class="form-row"><label class="input-label">Role *</label><input class="input-field" id="m-role" placeholder="Portfolio Manager" required /></div>
        <div class="form-row"><label class="input-label">Email</label><input class="input-field" id="m-email" type="email" placeholder="jane@example.com" /></div>
        <button class="btn btn-primary btn-w100" type="submit" id="member-submit" style="margin-top:8px;">Add Member</button>
      </form>
    </div>
  </div>`;

  function openModal() {
    document.getElementById('add-modal').classList.add('open');
    document.getElementById('m-name').focus();
  }
  function closeModal() { document.getElementById('add-modal').classList.remove('open'); }

  document.getElementById('add-member-btn').addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('add-modal').addEventListener('click', e => { if (e.target.id === 'add-modal') closeModal(); });

  document.getElementById('member-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('member-submit');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await api.createMember(
        document.getElementById('m-name').value.trim(),
        document.getElementById('m-role').value.trim(),
        document.getElementById('m-email').value.trim()
      );
      toast('Member added!', 'success');
      closeModal();
      document.getElementById('member-form').reset();
      await loadMembers();
    } catch (err) {
      toast(err.message || 'Failed to add member', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Add Member';
    }
  });

  await loadMembers();
}

async function loadMembers() {
  const grid = document.getElementById('members-grid');
  if (!grid) return;
  try {
    const members = await api.members();
    if (!members || members.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-title">No members yet</div>
        <p class="empty-desc">Add team members to start assigning them to projects and tasks.</p>
        <button class="btn btn-ghost" onclick="document.getElementById('add-member-btn').click()">+ Add Member</button>
      </div>`;
      return;
    }
    grid.innerHTML = `<div class="grid-3">${members.map((m, i) => {
      const color = AVATAR_COLORS[m.id % AVATAR_COLORS.length];
      return `<div class="card member-card stagger-item">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div class="member-avatar" style="background:${color}">${m.initials}</div>
          <div style="flex:1;min-width:0;">
            <div class="member-name">${m.name}</div>
            <div class="member-role">${m.role}</div>
            ${m.email ? `<div class="member-email">✉ ${m.email}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  } catch (err) {
    grid.innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center;">${err.message}</div>`;
  }
}
