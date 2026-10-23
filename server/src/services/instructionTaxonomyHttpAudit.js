const STRUCTURE_PATH = '/instrukcii-po-ohrane-truda';
const INSTRUCTION_PATH = '/instrukciya-po-ohrane-truda/';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function originUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an HTTP(S) origin`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new TypeError(`${label} must be an HTTP(S) origin without credentials or a path`);
  return url.origin;
}

function decodeEntities(value = '') {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(value).replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/giu,
    (match, entity) => {
      if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? match;
      const number =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : '\uFFFD';
    },
  );
}

function textContent(value) {
  return decodeEntities(value.replace(/<[^>]*>/gu, ''))
    .replace(/\s+/gu, ' ')
    .trim();
}

function attributes(value) {
  const result = new Map();
  const expression = /([^\s=/'"<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/gu;
  for (const match of value.matchAll(expression)) {
    const name = match[1].toLowerCase();
    if (!result.has(name)) result.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return result;
}

function inspectHtml(body) {
  const html = body
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '');
  const canonicals = [];
  const robots = [];
  const descriptions = [];
  const links = [];
  const expression = /<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/giu;
  for (const match of html.matchAll(expression)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    if (
      tag === 'link' &&
      (attrs.get('rel') || '').toLowerCase().split(/\s+/u).includes('canonical')
    )
      canonicals.push(attrs.get('href') ?? '');
    if (tag === 'meta' && (attrs.get('name') || '').toLowerCase() === 'robots')
      robots.push(attrs.get('content') ?? '');
    if (tag === 'meta' && (attrs.get('name') || '').toLowerCase() === 'description')
      descriptions.push(attrs.get('content') ?? '');
    if (tag === 'a' && attrs.has('href')) links.push(attrs.get('href'));
  }
  const elements = tag =>
    [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'giu'))].map(
      match => textContent(match[1]),
    );
  return {
    canonicals,
    robots,
    descriptions,
    links,
    titles: elements('title'),
    headings: elements('h1'),
  };
}

function isStructurePath(path) {
  return (
    path === STRUCTURE_PATH ||
    path.startsWith(`${STRUCTURE_PATH}/`) ||
    path.startsWith(INSTRUCTION_PATH)
  );
}

function normalizedText(value) {
  return String(value).replace(/\s+/gu, ' ').trim();
}

async function limitedBody(response) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('Response exceeds 8 MiB');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new Error('Response exceeds 8 MiB');
      chunks.push(next.value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function auditInstructionTaxonomyHttp({
  report,
  requestOrigin = report?.origin,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  maxRequests = 20000,
} = {}) {
  if (
    !report ||
    !Array.isArray(report.urls) ||
    !Array.isArray(report.redirects) ||
    !Array.isArray(report.sitemapUrls)
  )
    throw new TypeError(
      'An acceptance report with URL, redirect and sitemap inventories is required',
    );
  const origin = originUrl(report.origin, 'report.origin');
  const targetOrigin = originUrl(requestOrigin, 'requestOrigin');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    throw new TypeError('timeoutMs must be between 1 and 120000');
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 100000)
    throw new TypeError('maxRequests must be between 1 and 100000');
  if (report.technicalUrls !== undefined && !Array.isArray(report.technicalUrls))
    throw new TypeError('technicalUrls must be an array');

  const issues = [];
  const pages = [];
  const cache = new Map();
  const linkTargets = new Set();
  let requests = 0;
  let requestLimitReached = false;
  const issue = (code, url, detail, severity = 'error') =>
    issues.push({ severity, code, url, detail });

  function logicalUrl(value, base = `${origin}/`) {
    try {
      if (typeof value !== 'string') return null;
      const url = new URL(value, base);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      if (url.origin !== origin && url.origin !== targetOrigin) return null;
      url.host = new URL(origin).host;
      url.protocol = new URL(origin).protocol;
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  }

  function inventoryUrl(row) {
    if (!row || typeof row !== 'object' || ![200, 301, 404].includes(row.expectedStatus))
      throw new TypeError('Invalid URL inventory row');
    const url = new URL(row.url || row.path, origin);
    if (url.origin !== origin || url.username || url.password || url.hash)
      throw new TypeError(
        'Inventory URLs must belong to report.origin without credentials or fragments',
      );
    return url.href;
  }

  const rows = [...report.urls, ...(report.technicalUrls || [])].map(row => ({
    ...row,
    url: inventoryUrl(row),
  }));
  const redirects = report.redirects.map(row => ({ ...row, url: inventoryUrl(row) }));
  const sitemapExpected = new Set(
    report.sitemapUrls.map(value => {
      const url = new URL(value);
      if (url.origin !== origin || url.username || url.password || url.hash || url.search)
        throw new TypeError('Sitemap inventory must contain clean URLs on report.origin');
      return url.href;
    }),
  );

  const sitemapUrl = `${origin}/sitemap.xml`;
  const remainingHtmlChecks = new Map();
  for (const row of rows) {
    if (row.expectedStatus === 200)
      remainingHtmlChecks.set(row.url, (remainingHtmlChecks.get(row.url) || 0) + 1);
  }

  async function request(url) {
    if (cache.has(url)) return cache.get(url);
    if (requests >= maxRequests) {
      if (!requestLimitReached)
        issue(
          'REQUEST_LIMIT',
          url,
          `Stopped after ${maxRequests} requests; HTTP audit is incomplete`,
        );
      requestLimitReached = true;
      return null;
    }
    requests += 1;
    const target = new URL(url);
    const outgoing = new URL(`${target.pathname}${target.search}`, targetOrigin).href;
    const controller = new AbortController();
    let timer;
    try {
      const response = await Promise.race([
        (async () => {
          const response = await fetchImpl(outgoing, {
            method: 'GET',
            redirect: 'manual',
            credentials: 'omit',
            signal: controller.signal,
            headers: {
              Accept: 'text/html, application/xml;q=0.9',
              'User-Agent': 'BoykovDocs-Taxonomy-Acceptance/1',
            },
          });
          if (
            !response ||
            !Number.isInteger(response.status) ||
            response.status < 100 ||
            response.status > 599 ||
            typeof response.headers?.get !== 'function'
          )
            throw new Error('Invalid HTTP response status or headers');
          const result = {
            status: response.status,
            location: response.headers.get('location'),
            contentType: String(response.headers.get('content-type') || ''),
            robots: String(response.headers.get('x-robots-tag') || ''),
          };
          if (result.status === 200 && (remainingHtmlChecks.has(url) || url === sitemapUrl)) {
            const body = await limitedBody(response);
            if (url === sitemapUrl) result.sitemapBody = body;
            else result.html = inspectHtml(body);
          } else if (typeof response.body?.cancel === 'function') {
            await response.body.cancel().catch(() => {});
          }
          return result;
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timed out after ${timeoutMs} ms`));
          }, timeoutMs);
        }),
      ]);
      cache.set(url, response);
      return response;
    } catch (error) {
      issue('HTTP_REQUEST_FAILED', url, error.message);
      cache.set(url, null);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function trace(start, first) {
    let url = start;
    let response = first ?? (await request(url));
    const visited = new Set();
    const chain = [];
    for (let step = 0; response && REDIRECT_STATUSES.has(response.status); step += 1) {
      if (visited.has(url)) {
        issue('REDIRECT_CYCLE', start, `Redirect cycle at ${url}`);
        return chain;
      }
      if (step >= 5) {
        issue('REDIRECT_LIMIT', start, 'Redirect chain exceeds five hops');
        return chain;
      }
      visited.add(url);
      const next = response.location ? logicalUrl(response.location, url) : null;
      if (!next) {
        issue(
          'UNSAFE_REDIRECT',
          url,
          'Redirect has a missing, external or credential-bearing Location',
        );
        return chain;
      }
      chain.push({ from: url, status: response.status, to: next });
      url = next;
      response = await request(url);
    }
    if (response && (response.status < 200 || response.status >= 300))
      issue('BROKEN_LINK', start, `Final HTTP ${response.status} at ${url}`);
    return chain;
  }

  function inspectPage(row, response) {
    if (!/\btext\/html\b/iu.test(response.contentType))
      issue(
        'CONTENT_TYPE',
        row.url,
        `Expected HTML, received ${response.contentType || 'no content type'}`,
      );
    const html = response.html;
    if (typeof row.canonicalUrl === 'string') {
      if (html.canonicals.length !== 1)
        issue(
          'CANONICAL_COUNT',
          row.url,
          `Expected one canonical, found ${html.canonicals.length}`,
        );
      else if (html.canonicals[0] !== row.canonicalUrl)
        issue(
          'CANONICAL_MISMATCH',
          row.url,
          `Expected ${row.canonicalUrl}; received ${html.canonicals[0]}`,
        );
    }
    if (typeof row.description === 'string') {
      if (html.descriptions.length !== 1)
        issue(
          'DESCRIPTION_COUNT',
          row.url,
          `Expected one description, found ${html.descriptions.length}`,
        );
      else if (html.descriptions[0] !== row.description)
        issue(
          'DESCRIPTION_MISMATCH',
          row.url,
          `Expected ${row.description}; received ${html.descriptions[0]}`,
        );
    }
    if (typeof row.robots === 'string') {
      const actual = [...html.robots, response.robots]
        .join(',')
        .toLowerCase()
        .split(/[\s,]+/u)
        .filter(Boolean);
      const noindex = actual.includes('noindex') || actual.includes('none');
      const nofollow = actual.includes('nofollow') || actual.includes('none');
      const expected = row.robots.toLowerCase();
      if (noindex !== expected.includes('noindex') || nofollow !== expected.includes('nofollow'))
        issue(
          'ROBOTS_MISMATCH',
          row.url,
          `Expected ${row.robots}; received ${actual.join(', ') || 'implicit index, follow'}`,
        );
    }
    if (html.headings.length !== 1)
      issue('H1_COUNT', row.url, `Expected one H1, found ${html.headings.length}`);
    else if (typeof row.h1 === 'string' && html.headings[0] !== normalizedText(row.h1))
      issue('H1_MISMATCH', row.url, `Expected ${row.h1}; received ${html.headings[0]}`);
    if (html.titles.length !== 1)
      issue('TITLE_COUNT', row.url, `Expected one title, found ${html.titles.length}`);
    else if (typeof row.title === 'string' && html.titles[0] !== normalizedText(row.title))
      issue('TITLE_MISMATCH', row.url, `Expected ${row.title}; received ${html.titles[0]}`);
    const internalLinks = new Set();
    for (const href of html.links) {
      let link;
      try {
        link = logicalUrl(href, row.url);
      } catch {
        continue;
      }
      if (!link) continue;
      internalLinks.add(link);
      if (isStructurePath(new URL(link).pathname)) linkTargets.add(link);
    }
    for (const expected of row.expectedLinks || []) {
      let link;
      try {
        link = logicalUrl(expected, row.url);
      } catch {
        /* Invalid expected links are reported below. */
      }
      if (!link || !internalLinks.has(link))
        issue('MISSING_HTML_LINK', row.url, `Expected ordinary HTML link: ${expected}`);
    }
    return {
      canonical: html.canonicals,
      robots: html.robots,
      h1: html.headings,
      title: html.titles,
      internalLinks: internalLinks.size,
    };
  }

  for (const row of rows) {
    const response = await request(row.url);
    const entry = {
      url: row.url,
      expectedStatus: row.expectedStatus,
      status: response?.status ?? null,
    };
    pages.push(entry);
    if (!response) continue;
    if (response.status !== row.expectedStatus)
      issue(
        'STATUS_MISMATCH',
        row.url,
        `Expected HTTP ${row.expectedStatus}; received ${response.status}`,
      );
    if (row.expectedStatus === 200 && response.status === 200) {
      entry.html = inspectPage(row, response);
      const remaining = remainingHtmlChecks.get(row.url) - 1;
      if (remaining > 0) remainingHtmlChecks.set(row.url, remaining);
      else {
        remainingHtmlChecks.delete(row.url);
        delete response.html;
      }
    }
    if (REDIRECT_STATUSES.has(response.status)) entry.redirects = await trace(row.url, response);
  }
  for (const row of redirects) {
    const response = await request(row.url);
    const entry = {
      url: row.url,
      expectedStatus: row.expectedStatus,
      status: response?.status ?? null,
    };
    pages.push(entry);
    if (!response) continue;
    if (response.status !== row.expectedStatus)
      issue(
        'STATUS_MISMATCH',
        row.url,
        `Expected HTTP ${row.expectedStatus}; received ${response.status}`,
      );
    if (row.expectedStatus === 301 && response.status === 301) {
      const target = response.location ? logicalUrl(response.location, row.url) : null;
      const expected = row.location ? logicalUrl(row.location, row.url) : null;
      if (!target || !expected || target !== expected)
        issue(
          'REDIRECT_TARGET_MISMATCH',
          row.url,
          `Expected ${row.location}; received ${response.location || 'no Location'}`,
        );
    }
    if (REDIRECT_STATUSES.has(response.status)) entry.redirects = await trace(row.url, response);
  }
  for (const url of linkTargets) {
    const response = await request(url);
    if (response) await trace(url, response);
  }

  const sitemap = await request(sitemapUrl);
  let sitemapCount = 0;
  if (sitemap) {
    if (sitemap.status !== 200)
      issue('SITEMAP_STATUS', sitemapUrl, `Expected HTTP 200; received ${sitemap.status}`);
    else {
      if (!/\b(?:application|text)\/xml\b/iu.test(sitemap.contentType))
        issue(
          'SITEMAP_CONTENT_TYPE',
          sitemapUrl,
          `Expected XML, received ${sitemap.contentType || 'no content type'}`,
        );
      const xml = sitemap.sitemapBody.replace(/<!--[\s\S]*?-->/gu, '');
      delete sitemap.sitemapBody;
      if (!/<urlset\b/iu.test(xml) || !/<\/urlset\s*>/iu.test(xml))
        issue('SITEMAP_FORMAT', sitemapUrl, 'Expected a complete urlset sitemap');
      const locations = [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/giu)].map(match =>
        decodeEntities(match[1].trim()),
      );
      sitemapCount = locations.length;
      const observed = new Set();
      for (const location of locations) {
        if (observed.has(location)) issue('SITEMAP_DUPLICATE', sitemapUrl, location);
        observed.add(location);
        if (!sitemapExpected.has(location)) issue('SITEMAP_UNEXPECTED', sitemapUrl, location);
      }
      for (const expected of sitemapExpected)
        if (!observed.has(expected)) issue('SITEMAP_MISSING', sitemapUrl, expected);
    }
  }
  return {
    scope: 'http',
    origin,
    requestOrigin: targetOrigin,
    counts: {
      requests,
      checkedPages: pages.length,
      discoveredLinks: linkTargets.size,
      sitemapUrls: sitemapCount,
      errors: issues.filter(item => item.severity === 'error').length,
      warnings: issues.filter(item => item.severity === 'warning').length,
    },
    complete: !requestLimitReached && !issues.some(item => item.code === 'HTTP_REQUEST_FAILED'),
    pages,
    issues,
    limitations: [
      'Checks HTTP responses and initial HTML only; browser JavaScript, visual layout and authenticated actions are not exercised.',
      'Discovered links are checked one hop from inventory pages within the taxonomy and instruction namespaces; external sites are not crawled.',
      'Requests are sequential, limited to five redirect hops and 8 MiB per response; no authentication credentials are sent.',
      'A running site can change during the audit; use a consistent snapshot and quiet test environment for acceptance.',
    ],
  };
}
