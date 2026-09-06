// ============================================================
//  appstore.js – Shadow CMS Public App Store (Flexible Parser)
// ============================================================

export async function handleAppStorePage(request, env) {
  try {
    const { results: pages } = await env.DB.prepare(
      'SELECT slug, html, updated_at FROM pages ORDER BY updated_at DESC'
    ).all();

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

    allApps.sort((a, b) => b.updated_at - a.updated_at);
    const html = buildAppStorePage(allApps);
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('App Store error:', err);
    return new Response('App Store temporarily unavailable.', { status: 500 });
  }
}

// ----- Super Flexible Parser -----
function extractAppsFromPage(html, slug) {
  if (!html || typeof html !== 'string') return [];
  const results = [];

  // 1️⃣ Try .card (multiple apps)
  const cardRegex = /<a[^>]*class\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const cardContent = match[1];
    const fullTag = html.substring(match.index, match.index + match[0].length);
    const hrefMatch = fullTag.match(/<a[^>]*href\s*=\s*["']([^"']*)["']/i);
    const href = hrefMatch ? hrefMatch[1].trim() : '';
    const iconMatch = cardContent.match(/<img[^>]*src\s*=\s*["']([^"']*)["']/i);
    let icon = iconMatch ? iconMatch[1].trim() : '';
    const h2Match = cardContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!h2Match) continue;
    let nameHtml = h2Match[1].trim();
    let tag = '';
    const tagMatch = nameHtml.match(/<span[^>]*class\s*=\s*["'][^"']*\btag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (tagMatch) {
      tag = tagMatch[1].trim();
      nameHtml = nameHtml.replace(/<span[^>]*class\s*=\s*["'][^"']*\btag\b[^"']*["'][^>]*>[\s\S]*?<\/span>/i, '');
    }
    const name = nameHtml.trim();
    if (!name) continue;
    const descMatch = cardContent.match(/<span[^>]*class\s*=\s*["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const description = descMatch ? descMatch[1].trim() : '';
    const resolvedIcon = resolveIconUrl(icon, slug);
    let anchor = '';
    if (href.startsWith('#')) anchor = href.slice(1);
    results.push({ name, icon: resolvedIcon, description, tag, anchor });
  }
  if (results.length > 0) return results;

  // 2️⃣ Single app - try multiple class patterns
  const patterns = [
    { name: /<[^>]*class\s*=\s*["'][^"']*\bapp-name\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i, 
      icon: /<[^>]*class\s*=\s*["'][^"']*\bapp-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i,
      desc: /<[^>]*class\s*=\s*["'][^"']*\bapp-description\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i },
    { name: /<[^>]*class\s*=\s*["'][^"']*\bdetail-title\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i,
      icon: /<[^>]*class\s*=\s*["'][^"']*\bdetail-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i,
      desc: /<[^>]*class\s*=\s*["'][^"']*\bdetail-tagline\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i },
  ];

  for (const p of patterns) {
    const nameMatch = html.match(p.name);
    const iconMatch = html.match(p.icon);
    if (nameMatch && iconMatch) {
      const name = nameMatch[1].trim();
      let icon = iconMatch[1].trim();
      const descMatch = html.match(p.desc);
      const description = descMatch ? descMatch[1].trim() : '';
      if (name && icon) {
        return [{ name, icon: resolveIconUrl(icon, slug), description, tag: '', anchor: '' }];
      }
    }
  }

  // 3️⃣ FALLBACK – किसी भी <img> और <h1>/<h2>/<h3> को ढूंढो
  const imgMatch = html.match(/<img[^>]*src\s*=\s*["']([^"']*)["']/i);
  const headingMatch = html.match(/<h[1-3][^>]*>([^<]*)<\/h[1-3]>/i);
  if (imgMatch && headingMatch) {
    const icon = imgMatch[1].trim();
    const name = headingMatch[1].trim();
    if (name && icon) {
      // description: page ke first <p> ya <div> ka content
      const descMatch = html.match(/<(?:p|div)[^>]*>([^<]*)<\/(?:p|div)>/i);
      const description = descMatch ? descMatch[1].trim() : '';
      return [{ name, icon: resolveIconUrl(icon, slug), description, tag: '', anchor: '' }];
    }
  }

  return [];
}

function resolveIconUrl(icon, slug) {
  if (!icon) return '';
  if (/^https?:\/\//i.test(icon)) return icon;
  if (icon.startsWith('/')) return icon;
  return `/p/${slug}/${icon}`;
}

// ----- HTML page builder (same as before, included) -----
function buildAppStorePage(apps) {
  const esc = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  const escAttr = (str) => esc(str).replace(/"/g, '&quot;');

  let cardsHtml = '';
  if (!apps || apps.length === 0) {
    cardsHtml = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
          <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/>
        </svg>
        <p>No apps found</p>
      </div>`;
  } else {
    cardsHtml = apps.map((app, index) => {
      const icon = app.icon || '';
      const name = esc(app.name || 'Untitled App');
      const desc = esc(app.description || '');
      const tag = app.tag ? `<span class="app-tag">${esc(app.tag)}</span>` : '';
      const link = `/p/${escAttr(app.slug || '')}${app.anchor ? '#' + escAttr(app.anchor) : ''}`;
      const rating = app.rating ? Number(app.rating).toFixed(1) : '4.8';
      const size = app.size ? esc(app.size) : '24 MB';

      const iconHtml = icon
        ? `<img src="${escAttr(icon)}" alt="${name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'icon-fallback\\'>📱</div>'" />`
        : `<div class="icon-fallback">📱</div>`;

      return `
        <a href="${link}" class="app-card" data-category="${escAttr((app.tag || 'all').toLowerCase())}">
          <div class="rank-index">${index + 1}</div>
          <div class="app-icon-wrap">
            ${iconHtml}
          </div>
          <div class="app-details">
            <div class="app-title">${name}</div>
            <div class="app-sub-info">
              ${tag}
              <span class="rating">
                ${rating} 
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </span>
              <span class="dot">•</span>
              <span class="app-size">${size}</span>
            </div>
            ${desc ? `<div class="app-short-desc">${desc}</div>` : ''}
          </div>
          <div class="app-action">
            <span class="btn-install">Get</span>
          </div>
        </a>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Google Play</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --gp-bg: #1f1f1f;
      --gp-surface: #2d2f31;
      --gp-surface-variant: #35383b;
      --gp-search-bar: #303134;
      --gp-primary: #a8c7fa;
      --gp-primary-green: #01875f;
      --gp-primary-green-hover: #017250;
      --gp-text-primary: #e3e3e3;
      --gp-text-secondary: #c4c7c5;
      --gp-text-tertiary: #8e918f;
      --gp-divider: #444746;
      --gp-chip-bg: #282a2c;
      --gp-chip-selected-bg: #004a77;
      --gp-chip-selected-txt: #c2e7ff;
      --gp-radius-icon: 20%;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    body {
      background-color: var(--gp-bg);
      color: var(--gp-text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top AppBar / Search Bar */
    .top-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: var(--gp-bg);
      padding: 12px 16px 8px 16px;
    }

    .search-wrapper {
      max-width: 720px;
      margin: 0 auto;
      background: var(--gp-search-bar);
      border-radius: 28px;
      height: 48px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: background 0.2s, box-shadow 0.2s;
    }

    .search-wrapper:focus-within {
      background: var(--gp-surface);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }

    .play-logo-mini {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--gp-text-primary);
      font-size: 15px;
      font-weight: 400;
    }

    .search-input::placeholder {
      color: var(--gp-text-tertiary);
    }

    /* Category Filter Chips */
    .chips-scroll-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 8px 16px 4px 16px;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .chips-scroll-container::-webkit-scrollbar {
      display: none;
    }

    .chip {
      background: var(--gp-chip-bg);
      color: var(--gp-text-secondary);
      border: 1px solid var(--gp-divider);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }

    .chip.active {
      background: var(--gp-chip-selected-bg);
      color: var(--gp-chip-selected-txt);
      border-color: transparent;
    }

    /* Main App Feed */
    .layout-container {
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 8px 16px 80px 16px;
      flex: 1;
    }

    .section-title {
      font-family: 'Google Sans', sans-serif;
      font-size: 18px;
      font-weight: 500;
      margin: 16px 0 12px 0;
      color: var(--gp-text-primary);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .app-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* Authentic List Item Card */
    .app-card {
      display: flex;
      align-items: center;
      padding: 10px 8px;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: background-color 0.15s ease;
      position: relative;
    }

    .app-card:hover {
      background-color: rgba(255, 255, 255, 0.04);
    }

    .app-card:active {
      background-color: rgba(255, 255, 255, 0.08);
    }

    .rank-index {
      font-family: 'Google Sans', sans-serif;
      width: 24px;
      font-size: 14px;
      font-weight: 500;
      color: var(--gp-text-tertiary);
      text-align: left;
    }

    .app-icon-wrap {
      width: 54px;
      height: 54px;
      flex-shrink: 0;
      border-radius: var(--gp-radius-icon);
      background-color: var(--gp-surface);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .app-icon-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .icon-fallback {
      font-size: 24px;
    }

    .app-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-right: 8px;
    }

    .app-title {
      font-family: 'Google Sans', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: var(--gp-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .app-sub-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--gp-text-secondary);
    }

    .rating {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--gp-text-secondary);
      font-weight: 500;
    }

    .rating svg {
      color: var(--gp-text-secondary);
    }

    .dot {
      color: var(--gp-text-tertiary);
      font-size: 8px;
    }

    .app-tag {
      color: var(--gp-text-tertiary);
      font-weight: 400;
      text-transform: capitalize;
    }

    .app-short-desc {
      font-size: 12px;
      color: var(--gp-text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .app-action {
      flex-shrink: 0;
    }

    .btn-install {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 18px;
      font-size: 13px;
      font-weight: 500;
      font-family: 'Google Sans', sans-serif;
      background: transparent;
      color: var(--gp-primary-green);
      border: 1px solid var(--gp-divider);
      border-radius: 20px;
      transition: all 0.2s ease;
    }

    .app-card:hover .btn-install {
      background: var(--gp-primary-green);
      border-color: var(--gp-primary-green);
      color: #ffffff;
    }

    /* States */
    .empty-state, .no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      color: var(--gp-text-tertiary);
      gap: 12px;
      font-size: 14px;
    }

    .no-results {
      display: none;
    }

    /* Play Store Modern Floating Bottom Navigation */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: var(--gp-bg);
      border-top: 1px solid var(--gp-divider);
      display: flex;
      justify-content: space-around;
      align-items: center;
      z-index: 1000;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: var(--gp-text-tertiary);
      text-decoration: none;
      font-size: 11px;
      font-weight: 500;
      flex: 1;
      padding: 4px 0;
    }

    .nav-item.active {
      color: var(--gp-primary);
    }

    .nav-item svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    @media (min-width: 768px) {
      .app-list {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 24px;
      }
      .rank-index {
        display: none;
      }
    }
  </style>
</head>
<body>

  <!-- Search Header -->
  <header class="top-bar">
    <div class="search-wrapper">
      <div class="play-logo-mini">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path fill="#4285F4" d="M3.61 2.47L13.4 12.26 3.61 22.05A2.08 2.08 0 0 1 3 20.57V3.95c0-.58.23-1.11.61-1.48z"/>
          <path fill="#FBBC05" d="M16.92 8.74l-3.52 3.52 3.52 3.52 3.98-2.28c.7-.4.7-1.48 0-1.88l-3.98-2.88z"/>
          <path fill="#EA4335" d="M13.4 12.26L3.61 2.47c.37-.37.89-.6 1.48-.6.51 0 1.01.17 1.42.41l10.41 6.46-3.52 3.52z"/>
          <path fill="#34A853" d="M13.4 12.26l3.52 3.52-10.41 6.46c-.41.24-.91.41-1.42.41-.59 0-1.11-.23-1.48-.6l9.79-9.79z"/>
        </svg>
      </div>
      <input type="text" id="searchInput" class="search-input" placeholder="Search for apps & games" autocomplete="off" />
    </div>
  </header>

  <!-- Categories -->
  <div class="chips-scroll-container">
    <div class="chip active" data-filter="all">For you</div>
    <div class="chip" data-filter="top">Top charts</div>
    <div class="chip" data-filter="tool">Tools</div>
    <div class="chip" data-filter="game">Games</div>
    <div class="chip" data-filter="mod">Premium</div>
  </div>

  <!-- Content -->
  <main class="layout-container">
    <div class="section-title">
      <span>Recommended for you</span>
    </div>

    <div class="app-list" id="appGrid">
      ${cardsHtml}
    </div>

    <div class="no-results" id="noResults">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <div>No results found</div>
    </div>
  </main>

  <!-- Bottom Navigation -->
  <nav class="bottom-nav">
    <a href="#" class="nav-item">
      <svg viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
      Games
    </a>
    <a href="#" class="nav-item active">
      <svg viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
      Apps
    </a>
    <a href="#" class="nav-item">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
      Updates
    </a>
  </nav>

  <script>
    const searchInput = document.getElementById('searchInput');
    const cards = Array.from(document.querySelectorAll('.app-card'));
    const noResults = document.getElementById('noResults');
    const chips = document.querySelectorAll('.chip');
    let activeFilter = 'all';

    function applyFilters() {
      const query = searchInput.value.toLowerCase().trim();
      let matchedCount = 0;

      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const category = card.getAttribute('data-category') || '';
        
        const matchesSearch = text.includes(query);
        const matchesChip = (activeFilter === 'all') || category.includes(activeFilter);

        if (matchesSearch && matchesChip) {
          card.style.display = 'flex';
          matchedCount++;
        } else {
          card.style.display = 'none';
        }
      });

      noResults.style.display = (matchedCount === 0) ? 'flex' : 'none';
    }

    searchInput.addEventListener('input', applyFilters);

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter');
        applyFilters();
      });
    });
  </script>
</body>
</html>`;
}
