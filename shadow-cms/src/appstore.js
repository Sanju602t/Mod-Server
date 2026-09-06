// ============================================================
//  appstore.js – Shadow CMS Public App Store
//  Handles /appstore with multi-app extraction
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
    return new Response('Sorry, the App Store is temporarily unavailable.', {
      status: 500,
    });
  }
}

// -------------------- Main Parser --------------------
function extractAppsFromPage(html, slug) {
  if (!html || typeof html !== 'string') return [];
  const results = [];

  // 1️⃣ Multiple apps: <a class="card"> ... </a>
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

  // 2️⃣ Single app – try multiple patterns
  const single = extractSingleApp(html, slug);
  return single ? [single] : [];
}

// -------------------- Single‑App Extraction (with multiple patterns) --------------------
function extractSingleApp(html, slug) {
  // List of patterns to try in order
  const patterns = [
    // data-* convention
    {
      test: /<[^>]*\s+data-app\s+[^>]*>/i,
      name: /data-app-name\s*=\s*["']([^"']*)["']/i,
      icon: /data-app-icon\s*=\s*["']([^"']*)["']/i,
      desc: /data-app-description\s*=\s*["']([^"']*)["']/i,
    },
    // .app-name / .app-icon
    {
      test: /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-name\b[^"']*["'][^>]*>/i,
      name: /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-name\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i,
      icon: /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i,
      desc: /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-description\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i,
    },
    // .detail-title / .detail-icon (your new page)
    {
      test: /<[^>]*\bclass\s*=\s*["'][^"']*\bdetail-title\b[^"']*["'][^>]*>/i,
      name: /<[^>]*\bclass\s*=\s*["'][^"']*\bdetail-title\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i,
      icon: /<[^>]*\bclass\s*=\s*["'][^"']*\bdetail-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i,
      desc: /<[^>]*\bclass\s*=\s*["'][^"']*\bdetail-tagline\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i,
    },
    // Add more patterns here if needed
  ];

  for (const p of patterns) {
    if (p.test && p.test.test(html)) {
      const nameMatch = html.match(p.name);
      const iconMatch = html.match(p.icon);
      if (nameMatch && iconMatch) {
        const name = nameMatch[1].trim();
        let icon = iconMatch[1].trim();
        const descMatch = html.match(p.desc);
        const description = descMatch ? descMatch[1].trim() : '';
        if (name && icon) {
          return {
            name,
            icon: resolveIconUrl(icon, slug),
            description,
            tag: '',
            anchor: '',
          };
        }
      }
    }
  }
  return null;
}

function resolveIconUrl(icon, slug) {
  if (!icon) return '';
  if (/^https?:\/\//i.test(icon)) return icon;
  if (icon.startsWith('/')) return icon;
  return `/p/${slug}/${icon}`;
}

// -------------------- Build HTML page (unchanged, but included) --------------------
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
    .empty-state {
      text-align: center;
      padding: 3rem 0;
      color: var(--text-secondary);
      font-size: 1.2rem;
    }
    .no-results {
      display: none;
      text-align: center;
      padding: 2rem 0;
      color: var(--text-secondary);
    }
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