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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
  const escAttr = (str) => esc(str).replace(/"/g, '&quot;');

  let cardsHtml = '';
  if (apps.length === 0) {
    cardsHtml = `<div class="empty-state">No apps found. Check back later!</div>`;
  } else {
    cardsHtml = apps.map(app => {
      const icon = app.icon || '';
      const name = esc(app.name);
      const desc = esc(app.description);
      const tag = app.tag ? `<span class="badge">${esc(app.tag)}</span>` : '';
      const link = `/p/${app.slug}${app.anchor ? '#' + app.anchor : ''}`;
      const iconHtml = icon ? `<img src="${escAttr(icon)}" alt="${name}" onerror="this.style.display='none'" />` : `<div class="icon-fallback">📱</div>`;
      return `<a href="${escAttr(link)}" class="app-card">
        <div class="app-icon">${iconHtml}</div>
        <div class="app-info">
          <div class="app-name">${name}</div>
          ${tag}
          ${desc ? `<div class="app-desc">${desc}</div>` : ''}
        </div>
        <div class="app-action"><span class="install-btn">Install</span></div>
      </a>`;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadow App Store</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #121620;
      --bg-surface: #1a202c;
      --bg-card: #222938;
      --border-color: #2f3a4e;
      --neon-green: #00e676;
      --neon-green-glow: rgba(0, 230, 118, 0.15);
      --neon-cyan: #00d2ff;
      --txt-main: #ffffff;
      --txt-sub: #cbd5e1;
      --txt-muted: #8292a8;
      --radius: 16px;
      --shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg-base);
      color: var(--txt-sub);
      min-height: 100vh;
      background-image: radial-gradient(circle at 20% 30%, #1a2030 0%, var(--bg-base) 70%);
    }

    /* ----- Header ----- */
    .app-store-header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }
    .app-store-header h1 {
      font-size: 22px;
      font-weight: 800;
      color: var(--txt-main);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .app-store-header h1 span {
      background: linear-gradient(135deg, var(--neon-green), var(--neon-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 14px;
      font-weight: 700;
      background-clip: text;
    }
    .app-store-header h1 .store-icon {
      background: linear-gradient(135deg, var(--neon-green), var(--neon-cyan));
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      -webkit-text-fill-color: #fff;
    }
    .search-box {
      flex: 1;
      min-width: 180px;
      max-width: 420px;
    }
    .search-box input {
      width: 100%;
      padding: 10px 18px;
      border: 1px solid var(--border-color);
      border-radius: 30px;
      font-size: 14px;
      background: var(--bg-base);
      color: var(--txt-main);
      transition: all 0.3s ease;
      outline: none;
    }
    .search-box input::placeholder { color: var(--txt-muted); }
    .search-box input:focus {
      border-color: var(--neon-green);
      box-shadow: 0 0 0 3px var(--neon-green-glow);
      background: var(--bg-surface);
    }

    /* ----- Container ----- */
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    /* ----- Category Chips (optional) ----- */
    .categories {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 8px 0 16px 0;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .categories::-webkit-scrollbar { display: none; }
    .category-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      padding: 6px 18px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      color: var(--txt-sub);
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .category-chip:hover,
    .category-chip.active {
      background: var(--neon-green);
      color: #051614;
      border-color: var(--neon-green);
    }

    /* ----- App Grid (Google Play Style) ----- */
    .app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-top: 8px;
    }

    .app-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-card);
      padding: 14px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--border-color);
      text-decoration: none;
      color: var(--txt-main);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }
    .app-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0, 230, 118, 0.05), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .app-card:hover {
      transform: translateY(-4px);
      border-color: var(--neon-green);
      box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 0 30px var(--neon-green-glow);
    }
    .app-card:hover::before { opacity: 1; }

    .app-icon {
      flex-shrink: 0;
      width: 64px;
      height: 64px;
      border-radius: 14px;
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      overflow: hidden;
      border: 1px solid var(--border-color);
      position: relative;
      z-index: 1;
    }
    .app-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .app-icon .icon-fallback {
      font-size: 2rem;
      color: var(--txt-muted);
    }

    .app-info {
      flex: 1;
      min-width: 0;
      position: relative;
      z-index: 1;
    }
    .app-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--txt-main);
      line-height: 1.3;
    }
    .badge {
      display: inline-block;
      background: rgba(0, 230, 118, 0.15);
      color: var(--neon-green);
      font-size: 9px;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border: 1px solid rgba(0, 230, 118, 0.2);
      margin-top: 3px;
    }
    .app-desc {
      font-size: 13px;
      color: var(--txt-muted);
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }

    .app-action {
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }
    .install-btn {
      display: inline-block;
      background: linear-gradient(135deg, var(--neon-green) 0%, #00c853 100%);
      color: #051614;
      padding: 8px 20px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 800;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0, 230, 118, 0.25);
    }
    .app-card:hover .install-btn {
      transform: scale(1.04);
      box-shadow: 0 6px 24px rgba(0, 230, 118, 0.4);
    }

    /* ----- Empty State ----- */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--txt-muted);
      font-size: 16px;
      font-weight: 500;
      background: var(--bg-card);
      border-radius: var(--radius);
      border: 1px solid var(--border-color);
      grid-column: 1 / -1;
    }
    .empty-state span { font-size: 48px; display: block; margin-bottom: 16px; }

    /* ----- No Results ----- */
    .no-results {
      display: none;
      text-align: center;
      padding: 40px 20px;
      color: var(--txt-muted);
      font-size: 15px;
      font-weight: 500;
      grid-column: 1 / -1;
    }

    /* ----- Footer ----- */
    .footer {
      margin-top: 40px;
      padding: 20px 0;
      border-top: 1px solid var(--border-color);
      text-align: center;
      font-size: 12px;
      color: var(--txt-muted);
    }
    .footer a {
      color: var(--neon-cyan);
      text-decoration: none;
    }

    /* ----- Responsive ----- */
    @media (max-width: 640px) {
      .app-store-header { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 16px; }
      .app-store-header h1 { font-size: 19px; }
      .search-box { max-width: 100%; }
      .app-grid { grid-template-columns: 1fr; gap: 12px; }
      .app-card { padding: 12px 14px; }
      .app-icon { width: 52px; height: 52px; border-radius: 12px; }
      .app-name { font-size: 14px; }
      .install-btn { padding: 6px 14px; font-size: 12px; }
    }
    @media (min-width: 641px) and (max-width: 900px) {
      .app-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="app-store-header">
    <h1>
      <span class="store-icon">▶</span>
      App Store
      <span>Beta</span>
    </h1>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search apps, games, mods..." autofocus />
    </div>
  </header>

  <!-- Main -->
  <div class="container">
    <!-- Categories (optional - uncomment to enable)
    <div class="categories">
      <span class="category-chip active">🔥 All</span>
      <span class="category-chip">📱 Apps</span>
      <span class="category-chip">🎮 Games</span>
      <span class="category-chip">🛠 Mods</span>
      <span class="category-chip">⭐ Premium</span>
    </div>
    -->

    <div class="app-grid" id="appGrid">
      ${cardsHtml}
    </div>
    <div class="no-results" id="noResults">No apps match your search.</div>

    <div class="footer">
      Shadow App Store &bull; Powered by Shadow CMS &bull; <a href="/">Home</a>
    </div>
  </div>

  <script>
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
    filterApps();
  </script>
</body>
</html>`;
}