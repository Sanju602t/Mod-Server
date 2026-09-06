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

  // App render helper
  const renderCard = (app) => {
    const icon = app.icon || '';
    const name = esc(app.name || 'Untitled App');
    const desc = esc(app.description || '');
    const tag = app.tag ? `<span class="badge">${esc(app.tag)}</span>` : '';
    const link = `/p/${escAttr(app.slug || '')}${app.anchor ? '#' + escAttr(app.anchor) : ''}`;
    const iconHtml = icon
      ? `<img src="${escAttr(icon)}" alt="${name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'icon-fallback\\'>📦</div>'" />`
      : `<div class="icon-fallback">📦</div>`;

    return `
      <a href="${link}" class="app-tile" data-name="${name.toLowerCase()}" data-desc="${desc.toLowerCase()}">
        <div class="tile-icon-box">
          ${iconHtml}
        </div>
        <div class="tile-meta">
          <div class="tile-title">${name}</div>
          ${tag}
          ${desc ? `<div class="tile-desc">${desc}</div>` : ''}
        </div>
        <div class="tile-action">
          <span class="btn-get">Open</span>
        </div>
      </a>`;
  };

  const hasApps = apps && apps.length > 0;
  const listHtml = hasApps ? apps.map(renderCard).join('') : '<div class="empty-state">No apps available</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --panel: #131b26;
      --card-bg: rgba(26, 36, 52, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --txt-white: #f8fafc;
      --txt-muted: #94a3b8;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background-color: var(--bg);
      color: var(--txt-white);
      min-height: 100vh;
      overflow-x: hidden;
      padding-bottom: 40px;
    }

    /* Top Navigation Header */
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      background: rgba(11, 15, 23, 0.85);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #a5b4fc, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
    }

    .search-box {
      flex: 1;
      max-width: 400px;
      position: relative;
    }

    .search-box input {
      width: 100%;
      background: var(--panel);
      border: 1px solid var(--border);
      padding: 10px 16px;
      border-radius: 12px;
      color: var(--txt-white);
      font-size: 14px;
      outline: none;
      transition: all 0.2s ease;
    }

    .search-box input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    .main-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    /* Horizontal Rail / Carousel Section */
    .rail-section {
      margin-bottom: 36px;
    }

    .rail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding: 0 4px;
    }

    .rail-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--txt-white);
      letter-spacing: -0.3px;
    }

    .rail-scroll {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding: 6px 4px 16px 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
      -webkit-overflow-scrolling: touch;
    }

    .rail-scroll::-webkit-scrollbar {
      height: 6px;
    }

    .rail-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }

    /* Left-to-Right App Tile */
    .app-tile {
      flex: 0 0 150px;
      scroll-snap-align: start;
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 16px 12px 14px 12px;
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
    }

    .app-tile:hover {
      transform: translateY(-4px);
      border-color: rgba(99, 102, 241, 0.4);
      background: rgba(30, 42, 60, 0.85);
    }

    .tile-icon-box {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      background: var(--panel);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .tile-icon-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .icon-fallback {
      font-size: 28px;
    }

    .tile-meta {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }

    .tile-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--txt-white);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-bottom: 4px;
    }

    .badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      color: #818cf8;
      background: rgba(99, 102, 241, 0.15);
      padding: 2px 6px;
      border-radius: 6px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .tile-desc {
      font-size: 11px;
      color: var(--txt-muted);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .tile-action {
      width: 100%;
      margin-top: auto;
    }

    .btn-get {
      display: block;
      width: 100%;
      padding: 6px 0;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.08);
      color: var(--txt-white);
      border: 1px solid var(--border);
      transition: all 0.2s ease;
    }

    .app-tile:hover .btn-get {
      background: var(--accent);
      border-color: var(--accent);
    }

    .empty-state, .no-results {
      padding: 30px;
      color: var(--txt-muted);
      font-size: 14px;
      text-align: center;
    }

    .no-results {
      display: none;
    }

    @media (min-width: 600px) {
      .app-tile {
        flex: 0 0 160px;
      }
      .tile-icon-box {
        width: 76px;
        height: 76px;
      }
    }
  </style>
</head>
<body>

  <header class="top-nav">
    <div class="brand">AppHub</div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search apps..." />
    </div>
  </header>

  <div class="main-wrap">
    <section class="rail-section">
      <div class="rail-header">
        <h2 class="rail-title">Featured & Discover</h2>
      </div>
      <div class="rail-scroll" id="appGrid">
        ${listHtml}
      </div>
      <div class="no-results" id="noResults">No apps found matching your query.</div>
    </section>
  </div>

  <script>
    const searchInput = document.getElementById('searchInput');
    const tiles = Array.from(document.querySelectorAll('.app-tile'));
    const noResults = document.getElementById('noResults');

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      let matchCount = 0;

      tiles.forEach(tile => {
        const name = tile.getAttribute('data-name') || '';
        const desc = tile.getAttribute('data-desc') || '';
        const matches = name.includes(q) || desc.includes(q);

        tile.style.display = matches ? 'flex' : 'none';
        if (matches) matchCount++;
      });

      noResults.style.display = (matchCount === 0) ? 'block' : 'none';
    });
  </script>
</body>
</html>`;
}
