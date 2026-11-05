/* Sidebar + nav renderer for app pages */
const Nav = {
  render(activePage = '') {
    const user = Auth.getUser();
    const isAdmin = Auth.isAdmin();

    const sidebarHtml = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <a href="/" class="sidebar-brand">
            <div class="sidebar-brand-icon">📚</div>
            <span class="text-gradient">NotesHub</span>
          </a>
        </div>
        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Explore</div>
          <a href="/pages/notes.html" class="sidebar-link ${activePage === 'notes' ? 'active' : ''}">
            <span class="icon">🔍</span> Browse Notes
          </a>
          <a href="/pages/notes.html?sort=top_rated" class="sidebar-link ${activePage === 'top' ? 'active' : ''}">
            <span class="icon">⭐</span> Top Rated
          </a>
          <a href="/pages/notes.html?sort=most_downloaded" class="sidebar-link ${activePage === 'popular' ? 'active' : ''}">
            <span class="icon">🔥</span> Most Popular
          </a>

          ${user ? `
          <div class="sidebar-section-label">My Space</div>
          <a href="/pages/dashboard.html" class="sidebar-link ${activePage === 'dashboard' ? 'active' : ''}">
            <span class="icon">🏠</span> Dashboard
          </a>
          <a href="/pages/upload.html" class="sidebar-link ${activePage === 'upload' ? 'active' : ''}">
            <span class="icon">📤</span> Upload Notes
          </a>
          <a href="/pages/profile.html" class="sidebar-link ${activePage === 'profile' ? 'active' : ''}">
            <span class="icon">👤</span> My Profile
          </a>
          ` : ''}

          ${isAdmin ? `
          <div class="sidebar-section-label">Admin</div>
          <a href="/pages/admin.html" class="sidebar-link ${activePage === 'admin' ? 'active' : ''}">
            <span class="icon">🛡️</span> Admin Panel
          </a>
          ` : ''}
        </nav>
        <div class="sidebar-footer">
          ${user ? `
          <div class="sidebar-user" id="sidebar-user-menu">
            ${fmt.avatar(user.name, user.avatar_color)}
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(user.name)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(user.email)}</div>
            </div>
            <span style="color:var(--text-muted);font-size:1.2rem;cursor:pointer;" onclick="Auth.logout()" title="Logout">↩</span>
          </div>
          ` : `
          <div style="display:flex;gap:8px;flex-direction:column;">
            <a href="/pages/login.html" class="btn btn-secondary w-full" style="justify-content:center;">Login</a>
            <a href="/pages/register.html" class="btn btn-primary w-full" style="justify-content:center;">Sign Up</a>
          </div>
          `}
        </div>
      </aside>

      <!-- Mobile overlay -->
      <div id="sidebar-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99;" onclick="Nav.closeSidebar()"></div>

      <!-- Mobile top bar -->
      <div style="display:none;position:fixed;top:0;left:0;right:0;height:56px;background:var(--bg-surface);border-bottom:1px solid var(--border);z-index:98;align-items:center;padding:0 16px;gap:12px;" id="mobile-bar">
        <button onclick="Nav.openSidebar()" style="background:none;border:none;cursor:pointer;font-size:1.4rem;color:var(--text-primary)">☰</button>
        <a href="/" style="font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.2rem;">📚</span>
          <span class="text-gradient">NotesHub</span>
        </a>
      </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

    // Show mobile bar on small screens
    if (window.innerWidth <= 1024) {
      document.getElementById('mobile-bar').style.display = 'flex';
      document.querySelector('.main-content').style.paddingTop = '56px';
    }

    // Inject toast container
    if (!document.getElementById('toast-container')) {
      const tc = document.createElement('div');
      tc.id = 'toast-container';
      document.body.appendChild(tc);
    }
  },

  openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.add('open');
    overlay.style.display = 'block';
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  }
};

window.Nav = Nav;
