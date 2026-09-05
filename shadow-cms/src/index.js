// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS and preflight handling (if needed)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Cookie' } });
    }

    // Public routes
    if (path.startsWith('/n/')) {
      return handleNoteView(request, env);
    }
    if (path.startsWith('/raw/')) {
      return handleRawNote(request, env);
    }
    if (path.startsWith('/p/')) {
      return handlePageView(request, env);
    }

    // API routes
    if (path === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/logout' && request.method === 'POST') {
      return handleLogout(request, env);
    }
    if (path === '/api/session' && request.method === 'GET') {
      return handleSession(request, env);
    }
    if (path === '/api/notes') {
      return handleNotes(request, env);
    }
    if (path.startsWith('/api/notes/')) {
      return handleNoteById(request, env);
    }
    if (path === '/api/pages') {
      return handlePages(request, env);
    }
    if (path.startsWith('/api/pages/')) {
      return handlePageById(request, env);
    }
    // New App Store endpoint (authenticated read-only)
    if (path === '/api/apps' && request.method === 'GET') {
      return handleApps(request, env);
    }

    // Serve the SPA for all other routes (dashboard)
    return serveSPA(request, env);
  },
};

// ---------- Helper: Authentication ----------
async function getSessionUser(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.split(';').find(c => c.trim().startsWith('session='));
  if (!token) return null;
  const sessionToken = token.split('=')[1].trim();
  const result = await env.DB.prepare('SELECT user_id FROM sessions WHERE session_token = ? AND expires_at > datetime("now")').bind(sessionToken).first();
  return result ? result.user_id : null;
}

function requireAuth(request, env) {
  return getSessionUser(request, env);
}

// ---------- Login / Logout / Session ----------
async function handleLogin(request, env) {
  const { username, password } = await request.json();
  const validUser = env.USERNAME || 'admin';
  const validPass = env.PASSWORD || 'password';
  if (username !== validUser || password !== validPass) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  // Generate session token
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, 'admin', expires).run();
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    },
  });
}

async function handleLogout(request, env) {
  const user = await getSessionUser(request, env);
  if (user) {
    const cookie = request.headers.get('Cookie') || '';
    const token = cookie.split(';').find(c => c.trim().startsWith('session='));
    if (token) {
      const sessionToken = token.split('=')[1].trim();
      await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(sessionToken).run();
    }
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
}

async function handleSession(request, env) {
  const user = await getSessionUser(request, env);
  return new Response(JSON.stringify({ authenticated: !!user }), { headers: { 'Content-Type': 'application/json' } });
}

// ---------- Notes ----------
async function handleNotes(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC').all();
    return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const { title, content } = await request.json();
    const result = await env.DB.prepare('INSERT INTO notes (title, content) VALUES (?, ?) RETURNING id, created_at, updated_at')
      .bind(title, content).first();
    return new Response(JSON.stringify(result), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function handleNoteById(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = request.url.split('/').pop();
  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?').bind(id).first();
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'PUT') {
    const { title, content } = await request.json();
    const result = await env.DB.prepare('UPDATE notes SET title = ?, content = ?, updated_at = datetime("now") WHERE id = ? RETURNING id, created_at, updated_at')
      .bind(title, content, id).first();
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
    if (result.changes === 0) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

// Public note views
async function handleNoteView(request, env) {
  const id = request.url.split('/').pop();
  const note = await env.DB.prepare('SELECT title, content FROM notes WHERE id = ?').bind(id).first();
  if (!note) return new Response('Note not found', { status: 404 });
  const html = `<!DOCTYPE html><html><head><title>${note.title}</title></head><body><h1>${note.title}</h1><div>${note.content}</div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleRawNote(request, env) {
  const id = request.url.split('/').pop();
  const note = await env.DB.prepare('SELECT content FROM notes WHERE id = ?').bind(id).first();
  if (!note) return new Response('Note not found', { status: 404 });
  return new Response(note.content, { headers: { 'Content-Type': 'text/plain' } });
}

// ---------- Pages ----------
async function handlePages(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT id, slug, html, created_at, updated_at FROM pages ORDER BY updated_at DESC').all();
    return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const { slug, html } = await request.json();
    if (!slug || !html) return new Response('Missing slug or html', { status: 400 });
    // Check if slug exists
    const existing = await env.DB.prepare('SELECT id FROM pages WHERE slug = ?').bind(slug).first();
    if (existing) return new Response('Slug already exists', { status: 409 });
    const result = await env.DB.prepare('INSERT INTO pages (slug, html) VALUES (?, ?) RETURNING id, created_at, updated_at')
      .bind(slug, html).first();
    return new Response(JSON.stringify(result), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function handlePageById(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const id = request.url.split('/').pop();
  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT id, slug, html, created_at, updated_at FROM pages WHERE id = ?').bind(id).first();
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'PUT') {
    const { slug, html } = await request.json();
    if (!slug || !html) return new Response('Missing slug or html', { status: 400 });
    // Check if slug is already used by another page
    const existing = await env.DB.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').bind(slug, id).first();
    if (existing) return new Response('Slug already exists', { status: 409 });
    const result = await env.DB.prepare('UPDATE pages SET slug = ?, html = ?, updated_at = datetime("now") WHERE id = ? RETURNING id, created_at, updated_at')
      .bind(slug, html, id).first();
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
    if (result.changes === 0) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}

// Public page view
async function handlePageView(request, env) {
  const slug = request.url.split('/').pop();
  const page = await env.DB.prepare('SELECT html FROM pages WHERE slug = ?').bind(slug).first();
  if (!page) return new Response('Page not found', { status: 404 });
  // Render the HTML directly
  return new Response(page.html, { headers: { 'Content-Type': 'text/html' } });
}

// ---------- App Store ----------
// Extract app metadata from page HTML using regex (documented convention)
function extractAppMetadata(html, slug) {
  // Use class-based extraction: .app-name, .app-icon, .app-description (optional)
  // Also support data-* attributes for robustness: <div data-app-name="..." data-app-icon="..." data-app-description="...">
  let name = null, icon = null, description = null;

  // Try data attributes first
  const dataMatch = html.match(/<[^>]*data-app-name\s*=\s*["']([^"']*)["'][^>]*>/i);
  if (dataMatch) {
    name = dataMatch[1].trim();
    const iconMatch = html.match(/<[^>]*data-app-icon\s*=\s*["']([^"']*)["'][^>]*>/i);
    if (iconMatch) icon = iconMatch[1].trim();
    const descMatch = html.match(/<[^>]*data-app-description\s*=\s*["']([^"']*)["'][^>]*>/i);
    if (descMatch) description = descMatch[1].trim();
    if (name && icon) return { name, icon, description };
  }

  // Fallback to class-based extraction
  const nameRegex = /<[^>]*class\s*=\s*["'][^"']*app-name[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/i;
  const nameMatch = html.match(nameRegex);
  if (nameMatch) name = nameMatch[1].trim();

  // Icon: look for img with class app-icon, extract src
  const iconRegex = /<img[^>]*class\s*=\s*["'][^"']*app-icon[^"']*["'][^>]*src\s*=\s*["']([^"']*)["'][^>]*>/i;
  const iconMatch = html.match(iconRegex);
  if (iconMatch) icon = iconMatch[1].trim();

  // Description: paragraph with class app-description
  const descRegex = /<[^>]*class\s*=\s*["'][^"']*app-description[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/i;
  const descMatch = html.match(descRegex);
  if (descMatch) description = descMatch[1].trim();

  // If name or icon missing, return null (skip)
  if (!name || !icon) return null;
  // Resolve relative icon URL: if starts with '/', keep as is (will be relative to origin)
  // otherwise if not absolute, prepend '/'? Actually pages are served under /p/slug, so relative URLs will work.
  // We'll just pass through.
  return { name, icon, description };
}

async function handleApps(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Fetch all pages
  const pages = await env.DB.prepare('SELECT id, slug, html, updated_at FROM pages').all();
  const apps = [];
  for (const page of pages.results) {
    const metadata = extractAppMetadata(page.html, page.slug);
    if (metadata) {
      apps.push({
        id: page.id,
        name: metadata.name,
        icon: metadata.icon,
        description: metadata.description || null,
        slug: page.slug,
        url: `/p/${page.slug}`,
        updated_at: page.updated_at,
      });
    }
  }
  // Sort by updated_at descending
  apps.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return new Response(JSON.stringify(apps), { headers: { 'Content-Type': 'application/json' } });
}

// ---------- SPA (Dashboard) ----------
// The single-page application HTML with embedded CSS and JavaScript
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shadow CMS</title>
  <style>
    /* Reset & base */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #1a202c; padding: 1rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .header h1 { font-size: 1.8rem; }
    .header-actions { display: flex; gap: 1rem; align-items: center; }
    .btn { background: #e2e8f0; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.9rem; transition: background 0.2s; }
    .btn-primary { background: #3182ce; color: #fff; }
    .btn-primary:hover { background: #2b6cb0; }
    .btn-danger { background: #e53e3e; color: #fff; }
    .btn-danger:hover { background: #c53030; }
    .btn-outline { background: transparent; border: 1px solid #cbd5e0; }
    .btn-outline:hover { background: #edf2f7; }
    /* Navigation */
    .nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; flex-wrap: wrap; }
    .nav a { text-decoration: none; color: #4a5568; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 500; cursor: pointer; }
    .nav a.active { color: #2b6cb0; background: #ebf4ff; }
    .nav a:hover { background: #edf2f7; }
    /* Search */
    .search { margin-bottom: 1.5rem; }
    .search input { width: 100%; max-width: 400px; padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 0.375rem; }
    /* Cards grid */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
    .card { background: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1rem; transition: transform 0.2s; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .card img { width: 64px; height: 64px; object-fit: contain; display: block; margin-bottom: 0.5rem; }
    .card h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    .card p { color: #718096; font-size: 0.9rem; margin-bottom: 0.75rem; }
    .card .actions { display: flex; justify-content: flex-end; }
    /* Forms */
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-weight: 500; margin-bottom: 0.25rem; }
    .form-group input, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 0.375rem; }
    .form-group textarea { min-height: 150px; font-family: monospace; }
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 100; }
    .modal.active { display: flex; }
    .modal-content { background: #fff; padding: 2rem; border-radius: 0.5rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
    .toast { position: fixed; bottom: 1rem; right: 1rem; background: #1a202c; color: #fff; padding: 0.75rem 1.5rem; border-radius: 0.375rem; opacity: 0; transition: opacity 0.3s; z-index: 200; }
    .toast.show { opacity: 1; }
    .view { display: none; }
    .view.active { display: block; }
    .app-icon-placeholder { width: 64px; height: 64px; background: #e2e8f0; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #a0aec0; margin-bottom: 0.5rem; }
    /* Responsive */
    @media (max-width: 600px) {
      .header { flex-direction: column; align-items: stretch; gap: 0.5rem; }
      .header-actions { justify-content: flex-end; }
    }
  </style>
</head>
<body>
<div class="container" id="app">
  <!-- Header -->
  <header class="header">
    <h1>📝 Shadow CMS</h1>
    <div class="header-actions">
      <button class="btn btn-primary" id="addBtn">+ Add</button>
      <button class="btn btn-danger" id="logoutBtn">Logout</button>
    </div>
  </header>

  <!-- Navigation -->
  <nav class="nav" id="nav">
    <a data-view="notes" class="active">📝 Notes</a>
    <a data-view="pages">🌐 Pages</a>
    <a data-view="apps">📱 App Store</a>
  </nav>

  <!-- Search -->
  <div class="search" id="searchContainer">
    <input type="text" id="searchInput" placeholder="Search..." />
  </div>

  <!-- Views -->
  <div id="viewNotes" class="view active">
    <div id="notesList" class="card-grid"></div>
  </div>
  <div id="viewPages" class="view">
    <div id="pagesList" class="card-grid"></div>
  </div>
  <div id="viewApps" class="view">
    <div id="appsList" class="card-grid"></div>
  </div>

  <!-- Modal -->
  <div class="modal" id="modal">
    <div class="modal-content">
      <h2 id="modalTitle">Add New</h2>
      <form id="modalForm">
        <div class="form-group">
          <label for="modalSlug">Slug (for Pages)</label>
          <input type="text" id="modalSlug" placeholder="my-page" />
        </div>
        <div class="form-group">
          <label for="modalTitle">Title</label>
          <input type="text" id="modalTitle" placeholder="Title" />
        </div>
        <div class="form-group">
          <label for="modalContent">Content / HTML</label>
          <textarea id="modalContent" placeholder="Content..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modalCancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modalSave">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>
</div>

<script>
  // ---------- State ----------
  let currentView = 'notes';
  let notes = [];
  let pages = [];
  let apps = [];
  let editingId = null;
  let editingType = null; // 'note' or 'page'
  let searchTerm = '';

  // ---------- DOM refs ----------
  const $ = id => document.getElementById(id);
  const viewNotes = $('viewNotes');
  const viewPages = $('viewPages');
  const viewApps = $('viewApps');
  const notesList = $('notesList');
  const pagesList = $('pagesList');
  const appsList = $('appsList');
  const searchInput = $('searchInput');
  const modal = $('modal');
  const modalTitle = $('modalTitle');
  const modalForm = $('modalForm');
  const modalSlug = $('modalSlug');
  const modalTitleInput = $('modalTitle');
  const modalContent = $('modalContent');
  const modalCancel = $('modalCancel');
  const modalSave = $('modalSave');
  const addBtn = $('addBtn');
  const logoutBtn = $('logoutBtn');
  const toast = $('toast');
  const navLinks = document.querySelectorAll('#nav a');

  // ---------- Helpers ----------
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function api(method, url, data) {
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    }).then(res => res.json());
  }

  // ---------- Authentication ----------
  async function checkSession() {
    try {
      const res = await fetch('/api/session', { credentials: 'include' });
      const data = await res.json();
      if (!data.authenticated) {
        window.location.href = '/login'; // fallback, but we handle via SPA
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Render ----------
  function renderNotes() {
    const filtered = notes.filter(n => 
      n.title.toLowerCase().includes(searchTerm) ||
      n.content.toLowerCase().includes(searchTerm)
    );
    notesList.innerHTML = filtered.map(n => `
      <div class="card">
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.content.substring(0, 100))}</p>
        <div class="actions">
          <button class="btn btn-outline" onclick="editNote('${n.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteNote('${n.id}')">Delete</button>
        </div>
        <small>Updated: ${new Date(n.updated_at).toLocaleDateString()}</small>
      </div>
    `).join('');
  }

  function renderPages() {
    const filtered = pages.filter(p => 
      p.slug.toLowerCase().includes(searchTerm) ||
      p.html.toLowerCase().includes(searchTerm)
    );
    pagesList.innerHTML = filtered.map(p => `
      <div class="card">
        <h3>${escapeHtml(p.slug)}</h3>
        <p>${escapeHtml(p.html.substring(0, 100))}</p>
        <div class="actions">
          <button class="btn btn-outline" onclick="editPage('${p.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deletePage('${p.id}')">Delete</button>
          <a href="/p/${p.slug}" target="_blank" class="btn btn-primary">View</a>
        </div>
        <small>Updated: ${new Date(p.updated_at).toLocaleDateString()}</small>
      </div>
    `).join('');
  }

  function renderApps() {
    const filtered = apps.filter(a =>
      a.name.toLowerCase().includes(searchTerm) ||
      a.slug.toLowerCase().includes(searchTerm) ||
      (a.description && a.description.toLowerCase().includes(searchTerm))
    );
    appsList.innerHTML = filtered.map(a => `
      <div class="card">
        ${a.icon ? `<img src="${escapeHtml(a.icon)}" alt="${escapeHtml(a.name)}" onerror="this.style.display='none'" />` : `<div class="app-icon-placeholder">📱</div>`}
        <h3>${escapeHtml(a.name)}</h3>
        ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ''}
        <div class="actions">
          <a href="${a.url}" class="btn btn-primary">Open</a>
        </div>
        <small>Updated: ${new Date(a.updated_at).toLocaleDateString()}</small>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Data fetching ----------
  async function fetchNotes() {
    const data = await api('GET', '/api/notes');
    notes = data;
    if (currentView === 'notes') renderNotes();
  }

  async function fetchPages() {
    const data = await api('GET', '/api/pages');
    pages = data;
    if (currentView === 'pages') renderPages();
  }

  async function fetchApps() {
    const data = await api('GET', '/api/apps');
    apps = data;
    if (currentView === 'apps') renderApps();
  }

  // ---------- CRUD operations ----------
  window.editNote = (id) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    editingId = id;
    editingType = 'note';
    modalTitle.textContent = 'Edit Note';
    modalSlug.style.display = 'none';
    modalTitleInput.value = note.title;
    modalContent.value = note.content;
    modal.classList.add('active');
  };

  window.editPage = (id) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    editingId = id;
    editingType = 'page';
    modalTitle.textContent = 'Edit Page';
    modalSlug.style.display = 'block';
    modalSlug.value = page.slug;
    modalTitleInput.value = ''; // we don't have title for page
    modalTitleInput.style.display = 'none';
    modalContent.value = page.html;
    modal.classList.add('active');
  };

  window.deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return;
    await api('DELETE', `/api/notes/${id}`);
    showToast('Note deleted');
    fetchNotes();
  };

  window.deletePage = async (id) => {
    if (!confirm('Delete this page?')) return;
    await api('DELETE', `/api/pages/${id}`);
    showToast('Page deleted');
    fetchPages();
    fetchApps(); // refresh apps if any
  };

  // ---------- Modal handlers ----------
  modalCancel.addEventListener('click', () => modal.classList.remove('active'));

  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    if (editingType === 'note') {
      data.title = modalTitleInput.value;
      data.content = modalContent.value;
      if (editingId) {
        await api('PUT', `/api/notes/${editingId}`, data);
        showToast('Note updated');
      } else {
        await api('POST', '/api/notes', data);
        showToast('Note created');
      }
      fetchNotes();
    } else if (editingType === 'page') {
      data.slug = modalSlug.value.trim();
      data.html = modalContent.value;
      if (!data.slug) { showToast('Slug is required'); return; }
      if (editingId) {
        await api('PUT', `/api/pages/${editingId}`, data);
        showToast('Page updated');
      } else {
        await api('POST', '/api/pages', data);
        showToast('Page created');
      }
      fetchPages();
      fetchApps(); // refresh apps if new page qualifies
    }
    modal.classList.remove('active');
    // reset
    editingId = null;
    editingType = null;
    modalSlug.style.display = 'block';
    modalTitleInput.style.display = 'block';
    modalSlug.value = '';
    modalTitleInput.value = '';
    modalContent.value = '';
  });

  addBtn.addEventListener('click', () => {
    // Add based on current view
    if (currentView === 'notes') {
      editingType = 'note';
      modalTitle.textContent = 'Add Note';
      modalSlug.style.display = 'none';
      modalTitleInput.style.display = 'block';
      modalTitleInput.value = '';
      modalContent.value = '';
      modal.classList.add('active');
    } else if (currentView === 'pages') {
      editingType = 'page';
      modalTitle.textContent = 'Add Page';
      modalSlug.style.display = 'block';
      modalTitleInput.style.display = 'none';
      modalSlug.value = '';
      modalContent.value = '';
      modal.classList.add('active');
    } else {
      showToast('Add new apps by creating pages with app metadata');
    }
  });

  // ---------- Navigation ----------
  function switchView(view) {
    currentView = view;
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show selected
    if (view === 'notes') {
      viewNotes.classList.add('active');
      renderNotes();
    } else if (view === 'pages') {
      viewPages.classList.add('active');
      renderPages();
    } else if (view === 'apps') {
      viewApps.classList.add('active');
      renderApps();
    }
    // Update nav
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.view === view);
    });
    // Show/hide search
    searchInput.style.display = view === 'apps' ? 'block' : 'block'; // always show
    searchInput.placeholder = view === 'apps' ? 'Search apps...' : 'Search...';
    // Fetch data if needed
    if (view === 'apps') fetchApps();
    if (view === 'notes') fetchNotes();
    if (view === 'pages') fetchPages();
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchView(link.dataset.view);
    });
  });

  // ---------- Search ----------
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    if (currentView === 'notes') renderNotes();
    else if (currentView === 'pages') renderPages();
    else if (currentView === 'apps') renderApps();
  });

  // ---------- Logout ----------
  logoutBtn.addEventListener('click', async () => {
    await api('POST', '/api/logout');
    window.location.reload(); // will redirect to login if needed
  });

  // ---------- Init ----------
  (async function init() {
    const authenticated = await checkSession();
    if (!authenticated) {
      // Simple login form (in case session expired)
      const loginHtml = \`
        <div style="max-width:400px; margin: 2rem auto; padding: 2rem; background: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2>Login</h2>
          <form id="loginForm">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="loginUser" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="loginPass" required />
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
          </form>
          <div id="loginError" style="color:red;margin-top:0.5rem;"></div>
        </div>
      \`;
      document.body.innerHTML = loginHtml;
      document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value;
        const password = document.getElementById('loginPass').value;
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include',
          });
          if (res.ok) {
            window.location.reload();
          } else {
            document.getElementById('loginError').textContent = 'Invalid credentials';
          }
        } catch {
          document.getElementById('loginError').textContent = 'Login failed';
        }
      });
      return;
    }
    // Load initial data and show default view
    await fetchNotes();
    await fetchPages();
    await fetchApps();
    switchView('notes');
  })();
</script>
</body>
</html>`;

async function serveSPA(request, env) {
  // If the user is not authenticated, we could serve a login page directly,
  // but we embedded login in the SPA itself. We'll just serve the SPA.
  return new Response(INDEX_HTML, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// ---------- Database Migration (optional) ----------
// To be run once to create tables:
/*
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  html TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL
);
*/
