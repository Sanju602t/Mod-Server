// ============================================================
//  App Store Module – Shadow CMS
//  Standalone backend for /api/apps
// ============================================================

/**
 * Handle GET /api/apps – returns a JSON array of apps derived from CMS pages.
 * Authentication is assumed to have been performed by the caller.
 */
export async function handleAppStore(request, env) {
  try {
    // 1. Fetch all pages from D1
    const { results: pages } = await env.DB.prepare(
      'SELECT id, slug, html, updated_at FROM pages ORDER BY updated_at DESC'
    ).all();

    // 2. Extract app metadata from each page
    const apps = [];
    for (const page of pages) {
      const app = extractAppFromPage(page);
      if (app) {
        apps.push({
          id: page.id,
          name: app.name,
          icon: app.icon,
          description: app.description || '',
          slug: page.slug,
          url: `/p/${page.slug}`,
          updated_at: page.updated_at,
        });
      }
    }

    // 3. Return JSON
    return new Response(JSON.stringify(apps), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Log error (optional) and return a friendly message
    console.error('App Store error:', err);
    return new Response(JSON.stringify({ error: 'Failed to load apps' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Extract app metadata from a single page's HTML.
 * Returns null if the page does not contain valid app data.
 */
function extractAppFromPage(page) {
  const html = page.html;
  if (!html || typeof html !== 'string') return null;

  // ----- 1. PRIORITY: data-* convention -----
  // Look for an element with data-app attribute, then extract data-app-name, data-app-icon, etc.
  const dataAppRegex = /<[^>]*\s+data-app\s+[^>]*>/i;
  if (dataAppRegex.test(html)) {
    // Extract data-app-name
    const nameMatch = html.match(/data-app-name\s*=\s*["']([^"']*)["']/i);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // Extract data-app-icon
    const iconMatch = html.match(/data-app-icon\s*=\s*["']([^"']*)["']/i);
    let icon = iconMatch ? iconMatch[1].trim() : '';

    // Extract data-app-description (optional)
    const descMatch = html.match(/data-app-description\s*=\s*["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Validate required fields
    if (name && icon) {
      // Resolve relative icon URL
      const resolvedIcon = resolveIconUrl(icon, page.slug);
      return { name, icon: resolvedIcon, description };
    }
  }

  // ----- 2. FALLBACK: class-based convention (.app-name, .app-icon, .app-description) -----
  // Use regex to extract content from elements with these classes.
  // We'll try to find the content inside the first matching element.

  // Find .app-name content (assuming text inside h1, div, etc.)
  const nameRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-name\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i;
  const nameMatch2 = html.match(nameRegex);
  const name2 = nameMatch2 ? nameMatch2[1].trim() : '';

  // Find .app-icon src
  const iconRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-icon\b[^"']*["'][^>]*src\s*=\s*["']([^"']*)["']/i;
  const iconMatch2 = html.match(iconRegex);
  let icon2 = iconMatch2 ? iconMatch2[1].trim() : '';

  // Find .app-description content (optional)
  const descRegex = /<[^>]*\bclass\s*=\s*["'][^"']*\bapp-description\b[^"']*["'][^>]*>([^<]*)<\/[^>]*>/i;
  const descMatch2 = html.match(descRegex);
  const description2 = descMatch2 ? descMatch2[1].trim() : '';

  if (name2 && icon2) {
    const resolvedIcon = resolveIconUrl(icon2, page.slug);
    return { name: name2, icon: resolvedIcon, description: description2 };
  }

  // No valid app metadata found
  return null;
}

/**
 * Resolve relative icon URLs against the page's base URL.
 * The page is served at /p/:slug, so we use that as the base.
 */
function resolveIconUrl(icon, slug) {
  if (!icon) return '';
  // If it's already an absolute URL (http:// or https://), return as-is
  if (/^https?:\/\//i.test(icon)) {
    return icon;
  }
  // Relative URL: resolve against the page's base
  // For a page at /p/abc, the base is the origin + /p/abc/
  // We'll use the origin from the request? We don't have it here.
  // Instead, we can return a relative path that will be resolved by the browser.
  // Since we are returning data to the frontend, we can return the relative URL as-is
  // and let the browser resolve it relative to the current page (which is the CMS dashboard).
  // However, the icon is displayed in an img tag; the browser will resolve relative to the dashboard URL, which may be incorrect.
  // Better: we can construct an absolute URL using the origin of the request.
  // Since we don't have the request origin here, we can pass a placeholder or we can
  // use the slug to build a path like "/p/${slug}/${icon}" but that might not be correct.
  // The simplest robust approach: return the icon URL as-is, and if it starts with '/', it's root-relative.
  // For relative paths like "icon.png", we can prefix with "/p/${slug}/" to make it absolute.
  if (icon.startsWith('/')) {
    // Root-relative, keep it
    return icon;
  } else {
    // Relative to the page's directory: /p/${slug}/${icon}
    // But we don't have the origin. We'll return a relative path that the frontend can resolve
    // using the current location. However, the frontend can also use a base element or compute absolute.
    // To be safe, we'll return a root-relative path: /p/${slug}/${icon}
    return `/p/${slug}/${icon}`;
  }
}