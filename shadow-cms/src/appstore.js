// ============================================================
//  appstore.js – Shadow CMS App Store Module
//  Standalone public page & JSON API
// ============================================================

/**
 * Public App Store page handler – renders a complete HTML page.
 */
export async function handleAppStorePage(request, env) {
  try {
    // 1. Fetch all pages from D1
    const { results: pages } = await env.DB.prepare(
      'SELECT slug, html, updated_at FROM pages ORDER BY updated_at DESC'
    ).all();

    // 2. Extract all apps from all pages
    const allApps = [];
    for (const page of pages) {
      const apps = extractAppsFromPage(page.html, page.slug);
      for (const app of apps) {
        allApps.push({
          ...app,
          slug: page.slug,
          updated_at: page.updated_at,
        });
      }
    }

    // 3. Sort by updated_at descending (newest first)
    allApps.sort((a, b) => b.updated_at - a.updated_at);

    // 4. Build HTML page
    const html = buildAppStorePage(allApps);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('App Store page error:', err);
    return new Response('Sorry, the App Store is temporarily unavailable.', {
      status: 500,
    });
  }
}

/**
 * JSON API handler for /api/apps (used by admin dashboard).
 * Uses the same extraction logic, returns JSON.
 */
export async function handleAppStore(request, env) {
  try {
    const { results: pages } = await env.DB.prepare(
      'SELECT slug, html, updated_at FROM pages ORDER BY updated_at DESC'
    ).all();

    const allApps = [];
    for (const page of pages) {
      const apps = extractAppsFromPage(page.html, page.slug);
      for (const app of apps) {
        allApps.push({
          id: page.id,         // page id (if needed)
          name: app.name,
          icon: app.icon,
          description: app.description || '',
          tag: app.tag || '',
          slug: page.slug,
          url: `/p/${page.slug}${app.anchor ? '#' + app.anchor : ''}`,
          updated_at: page.updated_at,
        });
      }
    }

    allApps.sort((a, b) => b.updated_at - a.updated_at);

    return new Response(JSON.stringify(allApps), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('App Store API error:', err);
    return new Response(JSON.stringify({ error: 'Failed to load apps' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// -------------------- Helper: Extract apps from a single page --------------------
function extractAppsFromPage(html, slug) {
  if (!html || typeof html !== 'string') return [];

  const results = [];

  // ----- 1. TRY .cards .card structure (multiple apps) -----
  const cardRegex = /<a[^>]*class\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const cardContent = match[2];

    // Extract icon
    const iconMatch = cardContent.match(/<img[^>]*src\s*=\s*["']([^"']*)["']/i);
    let icon = iconMatch ? iconMatch[1].trim() : '';

    // Extract name (h2) – remove nested .tag
    const h2Match = cardContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!h2Match) continue;
    let nameHtml = h2Match[1].trim();
    // Remove .tag content
    const tagMatch = nameHtml.match(/<span[^>]*class\s*=\s*["'][^"']*\btag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    let tag = '';
    if (tagMatch) {
      tag = tagMatch[1].trim();
      nameHtml = nameHtml.replace(/<span[^>]*class\s*=\s*["'][^"']*\btag\b[^"']*["'][^>]*>[\s\S]*?<\/span>/i, '');
    }
    const name = nameHtml.trim();
    if (!name) continue;

    // Extract description (.desc)
    const descMatch = cardContent.match(/<span[^>]*class\s*=\s*["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Resolve icon URL
    const resolvedIcon = resolveIconUrl(icon, slug);

    // Determine anchor: from href, remove leading '#'
    let anchor = '';
    if (href.startsWith('#')) {
      anchor = href.slice(1);
    } else {
      // If href is a full URL or relative, we could still try to extract fragment, but for simplicity we keep as is.
      // The requirement says href="#youtube" so we assume it's a fragment.
      // If not, we might ignore or treat as full URL? We'll just use the href as anchor if it starts with '#'.
      // For other cases, we could fallback to using the app name slug, but we'll keep simple.
    }

    results.push({
      name,
      icon: resolvedIcon,
      description,
      tag,
      anchor, // the fragment part (e.g., "youtube")
    });
  }

  // If we found at least one card using the new structure, return them.
  if (results.length > 0) {
    return results;
  }

  // ----- 2. FALLBACK: single-app conventions (data-app or .app-name) -----
  // This preserves backward compatibility for pages that don't use .cards .card.
  const single = extractSingleApp(html, slug);
  return single ? [single] : [];
}

/**
 * Extract a single app using the old data-app or class-based conventions.
 */
function extractSingleApp(html, slug) {
  // data-* convention
  const dataAppRegex = /<[^>]*\s+data-app\s+[^>]*>/i;
  if (dataAppRegex.test(html)) {
    const nameMatch = html.match(/data-app-name\s*=\s*["']([^"']*)["']/i);
    const iconMatch = html.match(/data-app-icon\s*=\s*["']([^"']*)["']/i);
    const descMatch = html.match(/data-app-description\s*=\s*["']([^"']*)["']/i);
    const name = nameMatch ? nameMatch[1].trim() : '';
    let icon = iconMatch ? iconMatch[1].trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    if (name && icon) {
      return {
        name,
        icon: resolveIconUrl(icon, slug),
        description,
        tag: '',
        anchor: '', // no anchor for single app
      };
    }
  }

  // class-based (.app-name, .app-icon, .app-description)
  const nameRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-name\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i;
  const iconRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i;
  const descRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-description\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i;
  const nameMatch2 = html.match(nameRegex);
  const iconMatch2 = html.match(iconRegex);
  const descMatch2 = html.match(descRegex);
  const name2 = nameMatch2 ? nameMatch2[1].trim() : '';
  let icon2 = iconMatch2 ? iconMatch2[1].trim() : '';
  const description2 = descMatch2 ? descMatch2[1].trim() : '';
  if (name2 && icon2) {
    return {
      name: name2,
      icon: resolveIconUrl(icon2, slug),
      description: description2,
      tag: '',
      anchor: '',
    };
  }

  return null;
}

/**
 * Resolve relative icon URLs against the page's base ( /p/:slug/ ).
 */
function resolveIconUrl(icon, slug) {
  if (!icon) return '';
  if (/^https?:\/\//i.test(icon)) return icon;
  if (icon.startsWith('/')) return icon; // root-relative
  // relative to page: /p/${slug}/${icon}
  return `/p/${slug}/${icon}`;
}

// -------------------- Build the HTML page --------------------
function buildAppStorePage(apps) {
  // Escape HTML entities for safe rendering
  const esc = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
  const escAttr = (str) => esc(str).replace(/"/g, '&quot;');

  // Generate app cards HTML
  let cardsHtml = '';
  if (apps.length === 0) {
    cardsHtml = `<div class="empty-state">No apps found. Check back later!</div>`;
  } else {
    cardsHtml = apps.map(app => {
      const icon = app.icon || '';
      const name = esc(app.name);
      const desc = esc(app.description);
      const tag = app.tag ? `<span class="tag">${esc(app.tag)}</span>` : '';
      const link = `/p/${app.slug}${app.anchor ? '#' + app.anchor : ''}`;
      const iconHtml = icon ? `<img src="${escAttr(icon)}" alt="${name}" onerror="this.style.display='none'" />` : `<div class="icon-fallback">📱</div>`;
      return `<a href="${escAttr(link)}" class="app-card">
        <div class="app-icon">${iconHtml}</div>
        <div class="app-info">
          <div class="app-name">${name} ${tag}</div>
          ${desc ? `<div class="app-desc">${desc}</div>` : ''}
        </div>
        <div class="app-action"><span class="open-btn">Open</span></div>
      </a>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadow App Store</title>
  <style>
    /* ----- Reset & Variables ----- */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #f0f2f5;
      --card-bg: #ffffff;
      --text: #1a202c;
      --text-secondary: #4a5568;
      --primary: #5a6acf;
      --primary-hover: #4a5abc;
      --radius: 16px;
      --shadow: 0 4px 12px rgba(0,0,0,0.08);
      --transition: 0.2s ease;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    /* ----- Header ----- */
    .app-store-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      gap: 1rem;
    }
    .app-store-header h1 {
      font-size: 2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .app-store-header h1 span {
      background: var(--primary);
      color: #fff;
      font-size: 1rem;
      padding: 0.2rem 0.8rem;
      border-radius: 30px;
      margin-left: 0.5rem;
    }
    .search-box {
      flex: 1;
      min-width: 200px;
      max-width: 400px;
    }
    .search-box input {
      width: 100%;
      padding: 0.7rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 30px;
      font-size: 1rem;
      background: #fff;
      transition: border var(--transition);
    }
    .search-box input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(90, 106, 207, 0.2);
    }
    /* ----- App Grid ----- */
    .app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }
    .app-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--card-bg);
      padding: 1rem 1.2rem;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      text-decoration: none;
      color: var(--text);
      transition: transform var(--transition), box-shadow var(--transition);
      border: 1px solid transparent;
    }
    .app-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      border-color: var(--primary);
    }
    .app-icon {
      flex-shrink: 0;
      width: 60px;
      height: 60px;
      border-radius: 12px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      overflow: hidden;
    }
    .app-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .app-icon .icon-fallback {
      font-size: 2rem;
    }
    .app-info {
      flex: 1;
      min-width: 0;
    }
    .app-name {
      font-weight: 600;
      font-size: 1.1rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
    }
    .app-name .tag {
      background: #e2e8f0;
      color: var(--text-secondary);
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.5rem;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .app-desc {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-top: 0.2rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .app-action {
      flex-shrink: 0;
    }
    .open-btn {
      display: inline-block;
      background: var(--primary);
      color: #fff;
      padding: 0.4rem 1.2rem;
      border-radius: 30px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background var(--transition);
      white-space: nowrap;
    }
    .app-card:hover .open-btn {
      background: var(--primary-hover);
    }
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 3rem 0;
      color: var(--text-secondary);
      font-size: 1.2rem;
    }
    /* No results */
    .no-results {
      display: none;
      text-align: center;
      padding: 2rem 0;
      color: var(--text-secondary);
    }
    /* Responsive */
    @media (max-width: 640px) {
      .app-store-header { flex-direction: column; align-items: stretch; }
      .search-box { max-width: 100%; }
      .app-grid { grid-template-columns: 1fr; }
      .app-card { padding: 0.8rem 1rem; }
    }
  </style>
</head>
<body>
<div class="container">
  <header class="app-store-header">
    <h1>📱 App Store <span>Beta</span></h1>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search apps..." autofocus />
    </div>
  </header>
  <div class="app-grid" id="appGrid">
    ${cardsHtml}
  </div>
  <div class="no-results" id="noResults">No apps match your search.</div>
</div>

<script>
  // Client-side search
  const searchInput = document.getElementById('searchInput');
  const cards = document.querySelectorAll('.app-card');
  const noResults = document.getElementById('noResults');

  function filterApps() {
    const query = searchInput.value.toLowerCase().trim();
    let visible = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const match = text.includes(query);
      card.style.display = match ? 'flex' : 'none';
      if (match) visible++;
    });
    noResults.style.display = (visible === 0) ? 'block' : 'none';
  }

  searchInput.addEventListener('input', filterApps);

  // Initial filter (in case of pre-filled search)
  filterApps();
</script>
</body>
</html>`;
}