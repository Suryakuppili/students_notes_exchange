/* Auth state management */
const Auth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  },
  getToken() { return localStorage.getItem('token'); },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin() { return this.getUser()?.role === 'admin'; },

  async login(email, password) {
    const data = await api.login({ email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  async register(name, email, password, university) {
    const data = await api.register({ name, email, password, university });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  },

  updateUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = `/pages/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.isAdmin()) {
      toast.error('Admin access required');
      window.location.href = '/';
      return false;
    }
    return true;
  }
};

/* Toast notification system */
const toast = {
  _create(msg, type, icon) {
    const container = document.getElementById('toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(24px)'; el.style.transition = '0.3s ease'; setTimeout(() => el.remove(), 300); }, 3500);
  },
  success: (msg) => toast._create(msg, 'success', '✅'),
  error:   (msg) => toast._create(msg, 'error',   '❌'),
  info:    (msg) => toast._create(msg, 'info',     'ℹ️'),
};

/* Format helpers */
const fmt = {
  date(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return fmt.date(dateStr);
  },
  fileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  },
  fileType(mimeType) {
    if (mimeType.includes('pdf'))       return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('docx')) return 'DOCX';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT';
    if (mimeType.includes('image'))     return 'Image';
    if (mimeType.includes('text'))      return 'TXT';
    return 'File';
  },
  fileTypeClass(mimeType) {
    if (mimeType.includes('pdf'))   return 'type-pdf';
    if (mimeType.includes('word') || mimeType.includes('docx')) return 'type-docx';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'type-pptx';
    if (mimeType.includes('image')) return 'type-image';
    return 'type-txt';
  },
  stars(avg, count = 5) {
    let html = '<div class="stars stars-sm">';
    for (let i = 1; i <= count; i++) {
      html += `<span class="star ${i <= Math.round(avg) ? 'filled' : ''}">★</span>`;
    }
    html += `</div>`;
    return html;
  },
  avatar(name, color, size = '') {
    const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
    return `<div class="avatar ${size}" style="background:${color || '#6366f1'}">${initials}</div>`;
  },
  noteCard(note, showActions = false) {
    const typeLabel = fmt.fileType(note.file_type);
    const typeClass = fmt.fileTypeClass(note.file_type);
    const tags = Array.isArray(note.tags) ? note.tags : (note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    return `
      <div class="note-card" onclick="window.location.href='/pages/note-detail.html?id=${note.id}'">
        <div class="note-card-header">
          <h4 class="note-card-title">${escHtml(note.title)}</h4>
          <span class="note-card-type badge ${typeClass}">${typeLabel}</span>
        </div>
        <div class="note-card-meta">
          <span class="note-card-subject">${escHtml(note.subject)}</span>
          ${note.course ? `<span class="text-muted text-xs">${escHtml(note.course)}</span>` : ''}
        </div>
        ${note.description ? `<p class="text-sm" style="color:var(--text-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(note.description)}</p>` : ''}
        ${tags.length ? `<div class="tags-row">${tags.slice(0,3).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="note-card-footer">
          <div class="note-card-uploader">
            ${fmt.avatar(note.uploader_name, note.uploader_color)}
            <span class="text-xs text-muted">${escHtml(note.uploader_name || 'Unknown')}</span>
          </div>
          <div class="flex items-center gap-2">
            ${note.avg_rating > 0 ? `<span class="text-xs" style="color:#f59e0b">★ ${note.avg_rating.toFixed(1)}</span>` : ''}
            <span class="text-xs text-muted">⬇ ${note.download_count}</span>
          </div>
        </div>
      </div>`;
  }
};

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.Auth = Auth;
window.toast = toast;
window.fmt = fmt;
window.escHtml = escHtml;
