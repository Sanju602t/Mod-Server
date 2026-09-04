// ============================================================
//  Cloudflare Worker – Shadow CMS
// ============================================================

// -------------------- Embedded index.html --------------------
const INDEX_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadow CMS</title>
  <style>
    /* ----- CSS Reset & Variables ----- */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #f6f9fc;
      --card: #ffffff;
      --text: #1a202c;
      --text-secondary: #4a5568;
      --border: #e2e8f0;
      --primary: #5a6acf;
      --primary-hover: #4a5abc;
      --danger: #e53e3e;
      --danger-hover: #c53030;
      --radius: 12px;
      --shadow: 0 4px 12px rgba(0,0,0,0.05);
      --transition: 0.2s ease;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 1rem;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    #app {
      max-width: 1200px;
      width: 100%;
    }
    /* ----- Login ----- */
    #login-section {
      max-width: 400px;
      margin: 10vh auto;
      background: var(--card);
      padding: 2rem;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    #login-section h1 {
      margin-bottom: 1.5rem;
      font-weight: 600;
      font-size: 1.8rem;
      text-align: center;
    }
    .input-group {
      margin-bottom: 1rem;
    }
    .input-group label {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 0.3rem;
      color: var(--text-secondary);
    }
    .input-group input {
      width: 100%;
      padding: 0.7rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      transition: border var(--transition);
    }
    .input-group input:focus {
      outline: none;
      border-color: var(--primary);
    }
    .btn {
      display: inline-block;
      padding: 0.7rem 1.5rem;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--transition), transform 0.1s;
      text-decoration: none;
      text-align: center;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn:active { transform: scale(0.97); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: var(--danger-hover); }
    .btn-outline {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .btn-outline:hover { background: var(--bg); }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
    .btn-block { width: 100%; }
    #login-error {
      color: var(--danger);
      margin-top: 0.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    /* ----- Dashboard ----- */
    #dashboard-section {
      display: none;
    }
    .dashboard-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      gap: 1rem;
    }
    .dashboard-header h1 {
      font-weight: 700;
      font-size: 1.8rem;
    }
    .header-actions {
      display: flex;
      gap: 0.8rem;
      align-items: center;
    }
    .add-btn {
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      font-size: 1.8rem;
      cursor: pointer;
      transition: background var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(90, 106, 207, 0.3);
    }
    .add-btn:hover { background: var(--primary-hover); }
    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      padding: 0.5rem 1.2rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all var(--transition);
    }
    .logout-btn:hover {
      background: var(--danger);
      color: #fff;
      border-color: var(--danger);
    }
    /* ----- Search ----- */
    .search-bar {
      margin-bottom: 1.5rem;
    }
    .search-bar input {
      width: 100%;
      max-width: 400px;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
    }
    /* ----- Content sections ----- */
    .content-section {
      margin-bottom: 2.5rem;
    }
    .content-section h2 {
      font-size: 1.3rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--text-secondary);
      border-bottom: 2px solid var(--border);
      padding-bottom: 0.5rem;
    }
    .item-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .item-card {
      background: var(--card);
      border-radius: var(--radius);
      padding: 1.2rem;
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      transition: border var(--transition);
    }
    .item-card:hover { border-color: var(--primary); }
    .item-card .title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.4rem;
      word-break: break-word;
    }
    .item-card .meta {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 0.8rem;
    }
    .item-card .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .item-card .actions .btn {
      font-size: 0.75rem;
      padding: 0.3rem 0.7rem;
    }
    .empty-state {
      color: var(--text-secondary);
      padding: 2rem 0;
      text-align: center;
      font-style: italic;
    }
    /* ----- Modals ----- */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--card);
      border-radius: var(--radius);
      max-width: 700px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .modal h2 { margin-bottom: 1.5rem; font-weight: 600; }
    .modal .form-group { margin-bottom: 1.2rem; }
    .modal .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.3rem;
      color: var(--text-secondary);
    }
    .modal .form-group input,
    .modal .form-group textarea {
      width: 100%;
      padding: 0.7rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: border var(--transition);
    }
    .modal .form-group textarea {
      min-height: 120px;
      font-family: monospace;
      resize: vertical;
    }
    .modal .form-group input:focus,
    .modal .form-group textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    .modal .modal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      margin-top: 1.5rem;
      justify-content: flex-end;
    }
    .modal .modal-actions .btn { min-width: 80px; }
    .modal .modal-actions .btn-danger { margin-right: auto; }
    .preview-btn { margin-right: auto; }
    /* ----- Toast ----- */
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .toast {
      background: #1a202c;
      color: #fff;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
      max-width: 400px;
      font-size: 0.95rem;
    }
    .toast.error { background: var(--danger); }
    @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    /* ----- Responsive ----- */
    @media (max-width: 640px) {
      .dashboard-header { flex-direction: column; align-items: stretch; }
      .header-actions { justify-content: flex-end; }
      .item-grid { grid-template-columns: 1fr; }
      .modal { padding: 1.5rem; }
    }
  </style>
</head>
<body>
<div id="app">
  <!-- Login Section -->
  <section id="login-section">
    <h1>🔐 Shadow CMS</h1>
    <form id="login-form">
      <div class="input-group">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="Enter username" required />
      </div>
      <div class="input-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter password" required />
      </div>
      <button type="submit" class="btn btn-block">Log In</button>
      <div id="login-error"></div>
    </form>
  </section>

  <!-- Dashboard -->
  <section id="dashboard-section">
    <header class="dashboard-header">
      <h1>📝 Shadow CMS</h1>
      <div class="header-actions">
        <button class="add-btn" id="addBtn" title="Add content">+</button>
        <button class="logout-btn" id="logoutBtn">Logout</button>
      </div>
    </header>

    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="Search notes and pages..." />
    </div>

    <!-- Notes -->
    <section class="content-section" id="notes-section">
      <h2>📄 Notes</h2>
      <div id="notes-list" class="item-grid"></div>
      <div class="empty-state" id="notes-empty">No notes yet. Create one!</div>
    </section>

    <!-- Pages -->
    <section class="content-section" id="pages-section">
      <h2>🌐 Pages</h2>
      <div id="pages-list" class="item-grid"></div>
      <div class="empty-state" id="pages-empty">No pages yet. Create one!</div>
    </section>
  </section>

  <!-- Add Menu (floating) -->
  <div id="addMenu" style="display:none; position:fixed; bottom:6rem; right:2rem; background:var(--card); border-radius:var(--radius); box-shadow:0 8px 24px rgba(0,0,0,0.15); padding:0.5rem; z-index:500;">
    <button class="btn btn-block" style="border-radius:6px; margin-bottom:0.3rem;" data-action="note">📝 New Note</button>
    <button class="btn btn-block" style="border-radius:6px;" data-action="page">🌐 New Page</button>
  </div>

  <!-- Modals -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal" id="modalContent">
      <!-- Dynamic content rendered by JS -->
    </div>
  </div>

  <!-- Toast container -->
  <div class="toast-container" id="toastContainer"></div>
</div>

<script>
  // ============================================================
  //  FRONTEND – Vanilla JS SPA
  // ============================================================

  // --- State ---
  let currentUser = null;
  let notes = [];
  let pages = [];
  let searchTerm = '';

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const loginSection = $('#login-section');
  const dashboardSection = $('#dashboard-section');
  const loginForm = $('#login-form');
  const loginError = $('#login-error');
  const logoutBtn = $('#logoutBtn');
  const addBtn = $('#addBtn');
  const addMenu = $('#addMenu');
  const searchInput = $('#searchInput');
  const notesList = $('#notes-list');
  const pagesList = $('#pages-list');
  const notesEmpty = $('#notes-empty');
  const pagesEmpty = $('#pages-empty');
  const modalOverlay = $('#modalOverlay');
  const modalContent = $('#modalContent');
  const toastContainer = $('#toastContainer');

  // --- API helpers ---
  async function apiCall(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // send cookies
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + (isError ? 'error' : '');
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
  }

  // --- Authentication ---
  async function checkSession() {
    const { res, data } = await apiCall('GET', '/api/session');
    if (res.ok && data.authenticated) {
      currentUser = data.user;
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    loginError.textContent = '';
  }

  function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    fetchAllData();
  }

  // --- Login ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#username').value.trim();
    const password = $('#password').value.trim();
    loginError.textContent = '';
    const { res, data } = await apiCall('POST', '/api/login', { username, password });
    if (res.ok) {
      showToast('Logged in successfully');
      checkSession();
    } else {
      loginError.textContent = data.error || 'Invalid credentials';
    }
  });

  // --- Logout ---
  logoutBtn.addEventListener('click', async () => {
    await apiCall('POST', '/api/logout');
    currentUser = null;
    showLogin();
    showToast('Logged out');
  });

  // --- Fetch data ---
  async function fetchAllData() {
    await Promise.all([fetchNotes(), fetchPages()]);
    render();
  }

  async function fetchNotes() {
    const { res, data } = await apiCall('GET', '/api/notes');
    if (res.ok) { notes = data; } else { notes = []; showToast('Failed to load notes', true); }
  }

  async function fetchPages() {
    const { res, data } = await apiCall('GET', '/api/pages');
    if (res.ok) { pages = data; } else { pages = []; showToast('Failed to load pages', true); }
  }

  // --- Render ---
  function render() {
    const search = searchTerm.toLowerCase().trim();
    const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(search));
    const filteredPages = pages.filter(p => p.title.toLowerCase().includes(search) || p.slug.toLowerCase().includes(search));

    // Notes
    if (filteredNotes.length === 0) {
      notesList.innerHTML = '';
      notesEmpty.style.display = 'block';
    } else {
      notesEmpty.style.display = 'none';
      notesList.innerHTML = filteredNotes.map(n => createNoteCard(n)).join('');
    }

    // Pages
    if (filteredPages.length === 0) {
      pagesList.innerHTML = '';
      pagesEmpty.style.display = 'block';
    } else {
      pagesEmpty.style.display = 'none';
      pagesList.innerHTML = filteredPages.map(p => createPageCard(p)).join('');
    }

    // Attach event listeners to cards
    document.querySelectorAll('.item-card').forEach(card => {
      const id = card.dataset.id;
      const type = card.dataset.type;
      // Edit
      const editBtn = card.querySelector('.edit-btn');
      if (editBtn) editBtn.addEventListener('click', () => openEdit(type, id));
      // View
      const viewBtn = card.querySelector('.view-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          if (type === 'note') window.open('/n/' + id, '_blank');
          else {
            const slug = pages.find(p => p.id === id)?.slug;
            if (slug) window.open('/p/' + slug, '_blank');
          }
        });
      }
      // Copy URL
      const copyBtn = card.querySelector('.copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const url = type === 'note' ? '/n/' + id : '/p/' + (pages.find(p => p.id === id)?.slug || '');
          const full = window.location.origin + url;
          navigator.clipboard.writeText(full).then(() => showToast('URL copied!')).catch(() => {});
        });
      }
      // Delete
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm('Delete this ' + type + '?')) deleteItem(type, id);
        });
      }
    });
  }

  function createNoteCard(note) {
    const date = new Date(note.updated_at).toLocaleDateString();
    return '<div class="item-card" data-type="note" data-id="' + note.id + '">' +
      '<div class="title">' + escHtml(note.title) + '</div>' +
      '<div class="meta">Updated ' + date + '</div>' +
      '<div class="actions">' +
        '<button class="btn btn-sm edit-btn">Edit</button>' +
        '<button class="btn btn-sm view-btn">View</button>' +
        '<button class="btn btn-sm copy-btn">Copy URL</button>' +
        '<button class="btn btn-sm btn-danger delete-btn">Delete</button>' +
      '</div>' +
    '</div>';
  }

  function createPageCard(page) {
    const date = new Date(page.updated_at).toLocaleDateString();
    return '<div class="item-card" data-type="page" data-id="' + page.id + '">' +
      '<div class="title">' + escHtml(page.title) + '</div>' +
      '<div class="meta">/' + escHtml(page.slug) + ' · Updated ' + date + '</div>' +
      '<div class="actions">' +
        '<button class="btn btn-sm edit-btn">Edit</button>' +
        '<button class="btn btn-sm view-btn">View</button>' +
        '<button class="btn btn-sm copy-btn">Copy URL</button>' +
        '<button class="btn btn-sm btn-danger delete-btn">Delete</button>' +
      '</div>' +
    '</div>';
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Add menu ---
  let addMenuVisible = false;
  addBtn.addEventListener('click', () => {
    addMenuVisible = !addMenuVisible;
    addMenu.style.display = addMenuVisible ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!addBtn.contains(e.target) && !addMenu.contains(e.target)) {
      addMenu.style.display = 'none';
      addMenuVisible = false;
    }
  });
  addMenu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'note') openNewNote();
    else if (action === 'page') openNewPage();
    addMenu.style.display = 'none';
    addMenuVisible = false;
  });

  // --- Search ---
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });

  // --- Modal handling ---
  function openModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.classList.add('active');
    // Attach events inside modal
    const form = modalContent.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => e.preventDefault());
    }
    // Close on overlay click
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeModal();
    };
    // Cancel buttons
    modalContent.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', closeModal));
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    modalContent.innerHTML = '';
  }

  // --- New Note ---
  function openNewNote() {
    openModal(\`
      <h2>New Note</h2>
      <form id="noteForm">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="noteTitle" required />
        </div>
        <div class="form-group">
          <label>Content</label>
          <textarea id="noteContent" rows="8" required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn cancel-btn">Cancel</button>
          <button type="submit" class="btn" id="saveNoteBtn">Save</button>
        </div>
      </form>
    \`);
    const form = document.getElementById('noteForm');
    form.addEventListener('submit', async () => {
      const title = document.getElementById('noteTitle').value.trim();
      const content = document.getElementById('noteContent').value.trim();
      if (!title || !content) { showToast('Title and content required', true); return; }
      const { res, data } = await apiCall('POST', '/api/notes', { title, content });
      if (res.ok) { showToast('Note created'); closeModal(); await fetchNotes(); render(); }
      else { showToast(data.error || 'Failed to create note', true); }
    });
  }

  // --- Edit Note ---
  async function openEdit(type, id) {
    if (type === 'note') {
      const note = notes.find(n => n.id === id);
      if (!note) return;
      openModal(\`
        <h2>Edit Note</h2>
        <form id="noteForm">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="noteTitle" value="\${escHtml(note.title)}" required />
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea id="noteContent" rows="8" required>\${escHtml(note.content)}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-danger delete-btn" id="deleteNoteBtn">Delete</button>
            <button type="button" class="btn cancel-btn">Cancel</button>
            <button type="submit" class="btn" id="saveNoteBtn">Save</button>
          </div>
        </form>
      \`);
      const form = document.getElementById('noteForm');
      form.addEventListener('submit', async () => {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        if (!title || !content) { showToast('Title and content required', true); return; }
        const { res, data } = await apiCall('PUT', '/api/notes/' + id, { title, content });
        if (res.ok) { showToast('Note updated'); closeModal(); await fetchNotes(); render(); }
        else { showToast(data.error || 'Failed to update note', true); }
      });
      document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
        if (confirm('Delete this note?')) {
          const { res } = await apiCall('DELETE', '/api/notes/' + id);
          if (res.ok) { showToast('Note deleted'); closeModal(); await fetchNotes(); render(); }
          else { showToast('Delete failed', true); }
        }
      });
    } else if (type === 'page') {
      const page = pages.find(p => p.id === id);
      if (!page) return;
      openModal(\`
        <h2>Edit Page</h2>
        <form id="pageForm">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="pageTitle" value="\${escHtml(page.title)}" required />
          </div>
          <div class="form-group">
            <label>Slug</label>
            <input type="text" id="pageSlug" value="\${escHtml(page.slug)}" required pattern="[a-zA-Z0-9\\-]+" />
            <small style="color:var(--text-secondary);">Letters, numbers, hyphens only.</small>
          </div>
          <div class="form-group">
            <label>HTML</label>
            <textarea id="pageHtml" rows="10" required>\${escHtml(page.html)}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-danger delete-btn" id="deletePageBtn">Delete</button>
            <button type="button" class="btn preview-btn" id="previewPageBtn">Preview</button>
            <button type="button" class="btn cancel-btn">Cancel</button>
            <button type="submit" class="btn" id="savePageBtn">Save</button>
          </div>
        </form>
      \`);
      const form = document.getElementById('pageForm');
      form.addEventListener('submit', async () => {
        const title = document.getElementById('pageTitle').value.trim();
        const slug = document.getElementById('pageSlug').value.trim();
        const html = document.getElementById('pageHtml').value.trim();
        if (!title || !slug || !html) { showToast('All fields required', true); return; }
        const { res, data } = await apiCall('PUT', '/api/pages/' + id, { title, slug, html });
        if (res.ok) { showToast('Page updated'); closeModal(); await fetchPages(); render(); }
        else { showToast(data.error || 'Failed to update page', true); }
      });
      document.getElementById('deletePageBtn').addEventListener('click', async () => {
        if (confirm('Delete this page?')) {
          const { res } = await apiCall('DELETE', '/api/pages/' + id);
          if (res.ok) { showToast('Page deleted'); closeModal(); await fetchPages(); render(); }
          else { showToast('Delete failed', true); }
        }
      });
      document.getElementById('previewPageBtn').addEventListener('click', () => {
        const slug = document.getElementById('pageSlug').value.trim();
        if (slug) window.open('/p/' + slug, '_blank');
        else showToast('Enter a slug first', true);
      });
    }
  }

  // --- New Page ---
  function openNewPage() {
    openModal(\`
      <h2>New Page</h2>
      <form id="pageForm">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="pageTitle" required />
        </div>
        <div class="form-group">
          <label>Slug</label>
          <input type="text" id="pageSlug" required pattern="[a-zA-Z0-9\\-]+" />
          <small style="color:var(--text-secondary);">Letters, numbers, hyphens only.</small>
        </div>
        <div class="form-group">
          <label>HTML</label>
          <textarea id="pageHtml" rows="10" required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn preview-btn" id="previewPageBtn">Preview</button>
          <button type="button" class="btn cancel-btn">Cancel</button>
          <button type="submit" class="btn" id="savePageBtn">Save</button>
        </div>
      </form>
    \`);
    const form = document.getElementById('pageForm');
    form.addEventListener('submit', async () => {
      const title = document.getElementById('pageTitle').value.trim();
      const slug = document.getElementById('pageSlug').value.trim();
      const html = document.getElementById('pageHtml').value.trim();
      if (!title || !slug || !html) { showToast('All fields required', true); return; }
      const { res, data } = await apiCall('POST', '/api/pages', { title, slug, html });
      if (res.ok) { showToast('Page created'); closeModal(); await fetchPages(); render(); }
      else { showToast(data.error || 'Failed to create page', true); }
    });
    document.getElementById('previewPageBtn').addEventListener('click', () => {
      const slug = document.getElementById('pageSlug').value.trim();
      if (slug) window.open('/p/' + slug, '_blank');
      else showToast('Enter a slug first', true);
    });
  }

  // --- Delete item (from card) ---
  async function deleteItem(type, id) {
    const endpoint = type === 'note' ? '/api/notes/' + id : '/api/pages/' + id;
    const { res } = await apiCall('DELETE', endpoint);
    if (res.ok) {
      showToast(type + ' deleted');
      if (type === 'note') { await fetchNotes(); } else { await fetchPages(); }
      render();
    } else {
      showToast('Delete failed', true);
    }
  }

  // --- Init ---
  checkSession();
</script>
</body>
</html>`;

// ============================================================
//  WORKER HANDLER
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- API ---
    if (path.startsWith('/api/')) {
      return handleApi(request, env, ctx);
    }

    // --- Public note view ---
    if (path.startsWith('/n/')) {
      const id = path.slice(3);
      return handleNoteView(id, env);
    }

    // --- Raw note ---
    if (path.startsWith('/raw/')) {
      const id = path.slice(5);
      return handleRawNote(id, env);
    }

    // --- Public page ---
    if (path.startsWith('/p/')) {
      const slug = path.slice(3);
      return handlePageView(slug, env);
    }

    // --- Serve SPA (index.html) for all other GET requests ---
    return new Response(INDEX_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

// ============================================================
//  HELPERS
// ============================================================

function generateNoteId() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let id = '';
  for (let i = 0; i < array.length; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}

function generateSessionToken() {
  return crypto.randomUUID();
}

async function getSessionFromCookie(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const [k, ...v] = c.split('=');
      return [k, v.join('=')];
    })
  );
  const token = cookies.session_token;
  if (!token) return null;
  const stmt = env.DB.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?');
  const session = await stmt.bind(token, Math.floor(Date.now() / 1000)).first();
  return session;
}

async function requireAuth(request, env) {
  const session = await getSessionFromCookie(request, env);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

// ----- FIXED COOKIE FUNCTIONS (Secure always) -----
function setSessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  return `session_token=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return 'session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0';
}

// ============================================================
//  API HANDLING
// ============================================================

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // --- Login ---
  if (path === '/api/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;
    const validUser = env.USERNAME || 'Shadow';
    const validPass = env.PASSWORD;
    if (!validPass) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: PASSWORD secret not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (username === validUser && password === validPass) {
      const token = generateSessionToken();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 60 * 60 * 24 * 7; // 7 days
      await env.DB.prepare(
        'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
      ).bind(token, 'shadow', now, expiresAt).run();
      const cookie = setSessionCookie(token, expiresAt);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // --- Logout ---
  if (path === '/api/logout' && method === 'POST') {
    const session = await getSessionFromCookie(request, env);
    if (session) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(session.token).run();
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearSessionCookie(),
      },
    });
  }

  // --- Session check ---
  if (path === '/api/session' && method === 'GET') {
    const session = await getSessionFromCookie(request, env);
    if (session) {
      return new Response(JSON.stringify({ authenticated: true, user: 'Shadow' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // --- All other API endpoints require auth ---
  try {
    await requireAuth(request, env);
  } catch (err) {
    return err; // 401 response
  }

  // --- Notes ---
  if (path === '/api/notes' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
    return new Response(JSON.stringify(rows.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/notes' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { title, content } = body;
    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Title and content required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const id = generateNoteId();
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, title, content, now, now).run();
    const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
    return new Response(JSON.stringify(note), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // /api/notes/:id
  const noteMatch = path.match(/^\/api\/notes\/(.+)$/);
  if (noteMatch) {
    const id = noteMatch[1];
    if (method === 'GET') {
      const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
      if (!note) {
        return new Response(JSON.stringify({ error: 'Note not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(note), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      const { title, content } = body;
      if (!title || !content) {
        return new Response(JSON.stringify({ error: 'Title and content required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const now = Date.now();
      const result = await env.DB.prepare(
        'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?'
      ).bind(title, content, now, id).run();
      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Note not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
      return new Response(JSON.stringify(note), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (method === 'DELETE') {
      const result = await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Note not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // --- Pages ---
  if (path === '/api/pages' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all();
    return new Response(JSON.stringify(rows.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (path === '/api/pages' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { title, slug, html } = body;
    if (!title || !slug || !html) {
      return new Response(JSON.stringify({ error: 'Title, slug, and HTML required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!/^[a-zA-Z0-9\-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'Slug can only contain letters, numbers, and hyphens' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Check uniqueness
    const existing = await env.DB.prepare('SELECT id FROM pages WHERE slug = ?').bind(slug).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Slug already in use' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const id = generateNoteId();
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO pages (id, title, slug, html, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, title, slug, html, now, now).run();
    const page = await env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first();
    return new Response(JSON.stringify(page), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // /api/pages/:id
  const pageMatch = path.match(/^\/api\/pages\/(.+)$/);
  if (pageMatch) {
    const id = pageMatch[1];
    if (method === 'GET') {
      const page = await env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first();
      if (!page) {
        return new Response(JSON.stringify({ error: 'Page not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      const { title, slug, html } = body;
      if (!title || !slug || !html) {
        return new Response(JSON.stringify({ error: 'Title, slug, and HTML required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!/^[a-zA-Z0-9\-]+$/.test(slug)) {
        return new Response(JSON.stringify({ error: 'Slug can only contain letters, numbers, and hyphens' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Check uniqueness excluding current page
      const existing = await env.DB.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').bind(slug, id).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'Slug already in use' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const now = Date.now();
      const result = await env.DB.prepare(
        'UPDATE pages SET title = ?, slug = ?, html = ?, updated_at = ? WHERE id = ?'
      ).bind(title, slug, html, now, id).run();
      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Page not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const page = await env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first();
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (method === 'DELETE') {
      const result = await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Page not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
//  PUBLIC VIEWS
// ============================================================

async function handleNoteView(id, env) {
  const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
  if (!note) {
    return new Response('Note not found', { status: 404 });
  }
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a202c; }
    h1 { font-weight: 600; }
    .content { white-space: pre-wrap; word-wrap: break-word; }
    hr { margin: 2rem 0; border: 0; border-top: 1px solid #e2e8f0; }
    .raw-link { color: #5a6acf; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  <div class="content">${escapeHtml(note.content)}</div>
  <hr>
  <a href="/raw/${id}" class="raw-link">View raw text</a>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleRawNote(id, env) {
  const note = await env.DB.prepare('SELECT content FROM notes WHERE id = ?').bind(id).first();
  if (!note) {
    return new Response('Note not found', { status: 404 });
  }
  return new Response(note.content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function handlePageView(slug, env) {
  const page = await env.DB.prepare('SELECT html FROM pages WHERE slug = ?').bind(slug).first();
  if (!page) {
    return new Response('Page not found', { status: 404 });
  }
  return new Response(page.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
}
