import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import { auditInstructionTaxonomyHttp } from '../src/services/instructionTaxonomyHttpAudit.js';

const origin = 'https://boykovdocs.example';
const catalogPath = '/instrukcii-po-ohrane-truda/po-vidam-rabot/';
const instructionPath = '/instrukciya-po-ohrane-truda/mixed-Slug';
const draftPath = '/instrukcii-po-ohrane-truda/temy/draft/';
const oldPath = '/instrukcii-po-ohrane-truda/old/';

function pageHtml({
  title = 'Работы & документы',
  h1 = 'Инструкции по работам',
  robots = 'index, follow',
  canonical = `${origin}${catalogPath}`,
  links = [],
  description = 'Описание & проверка',
  extra = '',
} = {}) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<!doctype html><html><head><title>${escape(title)}</title><meta name="robots" content="${robots}">
    <meta name="description" content="${escape(description)}"><link rel="alternate canonical" href="${escape(canonical)}">${extra}</head>
    <body><h1>${escape(h1)}</h1>${links.map(href => `<a data-label=">" href='${escape(href)}'>Документ</a>`).join('')}</body></html>`;
}

function fixtureReport() {
  return {
    origin,
    urls: [
      {
        kind: 'catalog',
        code: 'H02',
        path: catalogPath,
        url: `${origin}${catalogPath}`,
        expectedStatus: 200,
        canonicalUrl: `${origin}${catalogPath}`,
        title: 'Работы & документы',
        h1: 'Инструкции по работам',
        description: 'Описание & проверка',
        robots: 'index, follow',
        inSitemap: true,
        expectedLinks: [instructionPath],
      },
      {
        kind: 'instruction',
        id: 'mixed',
        path: instructionPath,
        expectedStatus: 200,
        canonicalUrl: `${origin}${instructionPath}`,
        title: 'Инструкция',
        h1: 'Инструкция',
        robots: 'noindex, follow',
        inSitemap: false,
      },
      { kind: 'tag', path: draftPath, expectedStatus: 404 },
    ],
    redirects: [{ path: oldPath, expectedStatus: 301, location: catalogPath }],
    sitemapUrls: [`${origin}/`, `${origin}${catalogPath}`],
  };
}

function sitemap(locations) {
  return `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.map(url => `<url><loc>${url.replaceAll('&', '&amp;')}</loc></url>`).join('')}</urlset>`;
}

function routes(report = fixtureReport()) {
  return new Map([
    [catalogPath, { status: 200, body: pageHtml({ links: [instructionPath] }) }],
    [
      instructionPath,
      {
        status: 200,
        body: pageHtml({
          title: 'Инструкция',
          h1: 'Инструкция',
          robots: 'noindex, follow',
          canonical: `${origin}${instructionPath}`,
        }),
      },
    ],
    [draftPath, { status: 404, body: 'Not found' }],
    [oldPath, { status: 301, headers: { Location: catalogPath }, body: '' }],
    [
      '/sitemap.xml',
      {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
        body: sitemap(report.sitemapUrls),
      },
    ],
  ]);
}

function fakeFetch(routeMap, observed = []) {
  return async (url, options) => {
    observed.push({ url, options });
    const target = new URL(url);
    const route = routeMap.get(`${target.pathname}${target.search}`) || {
      status: 404,
      body: 'Not found',
    };
    return new Response(route.body, {
      status: route.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...route.headers },
    });
  };
}

async function listen(t, routeMap) {
  const server = http.createServer((request, response) => {
    const route = routeMap.get(request.url) || { status: 404, body: 'Not found' };
    response.writeHead(route.status, {
      'Content-Type': 'text/html; charset=utf-8',
      ...route.headers,
    });
    response.end(route.body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function codes(result) {
  return result.issues.map(issue => issue.code);
}

test('HTTP audit checks a local running site while retaining production canonical and sitemap expectations', async t => {
  const report = fixtureReport();
  const before = structuredClone(report);
  const requestOrigin = await listen(t, routes(report));
  const result = await auditInstructionTaxonomyHttp({ report, requestOrigin });
  assert.deepEqual(result.issues, []);
  assert.equal(result.scope, 'http');
  assert.equal(result.origin, origin);
  assert.equal(result.requestOrigin, requestOrigin);
  assert.equal(result.counts.requests, 5);
  assert.equal(result.counts.checkedPages, 4);
  assert.equal(result.counts.sitemapUrls, 2);
  assert.equal(result.complete, true);
  assert.deepEqual(report, before);
});

test('draft 404 and index/noindex pages are distinct expected states; technical URLs share metadata checks', async () => {
  const report = fixtureReport();
  report.technicalUrls = [
    {
      ...report.urls[0],
      path: `${catalogPath}?q=test&sort=newest`,
      url: `${origin}${catalogPath}?q=test&sort=newest`,
      robots: 'noindex, follow',
    },
    { path: `${catalogPath}?page=999`, expectedStatus: 404 },
  ];
  const map = routes(report);
  map.set(`${catalogPath}?q=test&sort=newest`, {
    status: 200,
    body: pageHtml({ robots: 'noindex, follow', links: [instructionPath] }),
  });
  const observed = [];
  const result = await auditInstructionTaxonomyHttp({
    report,
    fetchImpl: fakeFetch(map, observed),
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.counts.checkedPages, 6);
  assert.ok(
    observed.every(
      call =>
        call.options.method === 'GET' &&
        call.options.redirect === 'manual' &&
        call.options.credentials === 'omit',
    ),
  );
});

test('metadata failures report canonical count, robots, H1, title, description and absent ordinary links', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(catalogPath, {
    status: 200,
    body: pageHtml({
      title: 'Wrong',
      h1: 'Wrong',
      robots: 'noindex, nofollow',
      description: 'Wrong',
      extra: '<link rel="canonical" href="https://other.example/"><h1>Second</h1>',
    }),
  });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  for (const code of [
    'CANONICAL_COUNT',
    'ROBOTS_MISMATCH',
    'H1_COUNT',
    'TITLE_MISMATCH',
    'DESCRIPTION_MISMATCH',
    'MISSING_HTML_LINK',
  ])
    assert.ok(codes(result).includes(code), code);
});

test('canonical and H1 mismatch are reported independently of valid HTML structure', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(catalogPath, {
    status: 200,
    body: pageHtml({ canonical: 'https://wrong.example/', h1: 'Wrong', links: [instructionPath] }),
  });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(result).includes('CANONICAL_MISMATCH'));
  assert.ok(codes(result).includes('H1_MISMATCH'));
});

test('fake metadata and anchors inside scripts, styles, templates and comments are ignored', async () => {
  const report = fixtureReport();
  const map = routes(report);
  const fake = `<link rel="canonical" href="wrong"><h1>Wrong</h1><a href="${catalogPath}broken/">Wrong</a>`;
  map.set(catalogPath, {
    status: 200,
    body: pageHtml({
      links: [instructionPath],
      extra: `<script>let example = '${fake}';</script><style>/* ${fake} */</style><template>${fake}</template><!-- ${fake} -->`,
    }),
  });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.deepEqual(result.issues, []);
});

test('robots header can conservatively override HTML and is verified with directive semantics', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.get(catalogPath).headers = { 'X-Robots-Tag': 'noindex' };
  map.set(instructionPath, {
    status: 200,
    headers: { 'X-Robots-Tag': 'noindex, max-image-preview:large' },
    body: pageHtml({
      title: 'Инструкция',
      h1: 'Инструкция',
      canonical: `${origin}${instructionPath}`,
      robots: 'index, follow',
    }),
  });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  const failures = result.issues.filter(issue => issue.code === 'ROBOTS_MISMATCH');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].url, `${origin}${catalogPath}`);
});

test('links discovered in initial HTML detect broken documents without crawling external sites', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(catalogPath, {
    status: 200,
    body: pageHtml({
      links: [
        instructionPath,
        '/instrukciya-po-ohrane-truda/missing',
        'https://external.example/private',
      ],
    }),
  });
  const observed = [];
  const result = await auditInstructionTaxonomyHttp({
    report,
    fetchImpl: fakeFetch(map, observed),
  });
  assert.ok(
    result.issues.some(issue => issue.code === 'BROKEN_LINK' && issue.url.endsWith('/missing')),
  );
  assert.ok(observed.every(call => new URL(call.url).origin === origin));
});

test('redirect cycles, wrong direct targets and external redirect locations are errors', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(oldPath, { status: 301, headers: { Location: `${oldPath}loop/` }, body: '' });
  map.set(`${oldPath}loop/`, { status: 301, headers: { Location: oldPath }, body: '' });
  const cycle = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(cycle).includes('REDIRECT_TARGET_MISMATCH'));
  assert.ok(codes(cycle).includes('REDIRECT_CYCLE'));
  map.set(oldPath, { status: 301, headers: { Location: 'https://outside.example/' }, body: '' });
  const observed = [];
  const external = await auditInstructionTaxonomyHttp({
    report,
    fetchImpl: fakeFetch(map, observed),
  });
  assert.ok(codes(external).includes('UNSAFE_REDIRECT'));
  assert.ok(observed.every(call => new URL(call.url).origin === origin));
});

test('redirect tracing is bounded to five hops and missing Location is unsafe', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(oldPath, { status: 301, headers: { Location: `${oldPath}0` }, body: '' });
  for (let index = 0; index < 7; index += 1)
    map.set(`${oldPath}${index}`, {
      status: 301,
      headers: { Location: `${oldPath}${index + 1}` },
      body: '',
    });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(result).includes('REDIRECT_LIMIT'));
  map.set(oldPath, { status: 301, body: '' });
  const missing = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(missing).includes('UNSAFE_REDIRECT'));
});

test('sitemap exact inventory catches duplicates, missing pages, extraneous noindex URLs and wrong XML', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set('/sitemap.xml', {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
    body: sitemap([`${origin}/`, `${origin}/`, `${origin}${instructionPath}`]),
  });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  for (const code of ['SITEMAP_DUPLICATE', 'SITEMAP_MISSING', 'SITEMAP_UNEXPECTED'])
    assert.ok(codes(result).includes(code), code);
  map.set('/sitemap.xml', { status: 200, body: '<html>Not a sitemap</html>' });
  const invalid = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(invalid).includes('SITEMAP_FORMAT'));
  assert.ok(codes(invalid).includes('SITEMAP_CONTENT_TYPE'));
});

test('request and response-body timeouts return incomplete reports and abort signals', async () => {
  const report = fixtureReport();
  let signals = [];
  const waiting = async (_url, options) => {
    signals.push(options.signal);
    return new Promise(() => {});
  };
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: waiting, timeoutMs: 5 });
  assert.equal(result.complete, false);
  assert.ok(codes(result).includes('HTTP_REQUEST_FAILED'));
  assert.ok(signals.every(signal => signal.aborted));
  signals = [];
  const bodyWaiting = async (_url, options) => {
    signals.push(options.signal);
    return {
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      text: () => new Promise(() => {}),
    };
  };
  const body = await auditInstructionTaxonomyHttp({ report, fetchImpl: bodyWaiting, timeoutMs: 5 });
  assert.equal(body.complete, false);
  assert.equal(signals.filter(signal => signal.aborted).length, 3);
});

test('request count limits make incompleteness explicit and response bodies are bounded', async () => {
  const report = fixtureReport();
  const limited = await auditInstructionTaxonomyHttp({
    report,
    fetchImpl: fakeFetch(routes(report)),
    maxRequests: 1,
  });
  assert.equal(limited.counts.requests, 1);
  assert.equal(limited.complete, false);
  assert.equal(codes(limited).filter(code => code === 'REQUEST_LIMIT').length, 1);
  const large = await auditInstructionTaxonomyHttp({
    report,
    fetchImpl: async () => new Response('a'.repeat(8 * 1024 * 1024 + 1)),
    maxRequests: 1,
  });
  assert.ok(
    large.issues.some(
      issue => issue.code === 'HTTP_REQUEST_FAILED' && issue.detail.includes('8 MiB'),
    ),
  );
});

test('invalid input origins, foreign inventories and invalid bounds are rejected before network access', async () => {
  const report = fixtureReport();
  const neverFetch = () => {
    throw new Error('must not fetch');
  };
  await assert.rejects(
    auditInstructionTaxonomyHttp({
      report,
      requestOrigin: 'https://name:password@example.test/',
      fetchImpl: neverFetch,
    }),
    /without credentials/u,
  );
  await assert.rejects(
    auditInstructionTaxonomyHttp({
      report: { ...report, urls: [{ path: 'https://foreign.example/', expectedStatus: 200 }] },
      fetchImpl: neverFetch,
    }),
    /Inventory URLs/u,
  );
  await assert.rejects(
    auditInstructionTaxonomyHttp({ report, maxRequests: 0, fetchImpl: neverFetch }),
    /maxRequests/u,
  );
  await assert.rejects(
    auditInstructionTaxonomyHttp({ report, timeoutMs: 0, fetchImpl: neverFetch }),
    /timeoutMs/u,
  );
  await assert.rejects(
    auditInstructionTaxonomyHttp({
      report: { ...report, sitemapUrls: [`${origin}/?q=x`] },
      fetchImpl: neverFetch,
    }),
    /Sitemap inventory/u,
  );
});

test('duplicate inventory rows reuse compact parsed metadata and link-only responses never read bodies', async () => {
  const report = fixtureReport();
  report.urls.push(structuredClone(report.urls[0]));
  const map = routes(report);
  map.get(catalogPath).body =
    pageHtml({ links: [instructionPath, '/instrukciya-po-ohrane-truda/extra'] }) +
    '<!--' +
    'x'.repeat(1024 * 1024) +
    '-->';
  map.set('/instrukciya-po-ohrane-truda/extra', { status: 200, body: 'not required' });
  const bodyReads = new Map();
  const calls = new Map();
  const fetchImpl = async url => {
    const path = new URL(url).pathname;
    calls.set(path, (calls.get(path) || 0) + 1);
    const route = map.get(path);
    return {
      status: route.status,
      headers: new Headers({ 'Content-Type': 'text/html', ...route.headers }),
      text: async () => {
        bodyReads.set(path, (bodyReads.get(path) || 0) + 1);
        return route.body;
      },
    };
  };
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl });
  assert.deepEqual(result.issues, []);
  assert.equal(calls.get(catalogPath), 1);
  assert.equal(calls.get(instructionPath), 1);
  assert.equal(bodyReads.get(catalogPath), 1);
  assert.equal(bodyReads.has(oldPath), false);
  assert.equal(bodyReads.has(draftPath), false);
  assert.equal(bodyReads.has('/instrukciya-po-ohrane-truda/extra'), false);
  assert.ok(!JSON.stringify(result).includes('x'.repeat(1024)));
});

test('malformed redirect locations are reported without aborting the remaining HTTP audit', async () => {
  const report = fixtureReport();
  const map = routes(report);
  map.set(oldPath, { status: 301, headers: { Location: 'http://[' }, body: '' });
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl: fakeFetch(map) });
  assert.ok(codes(result).includes('UNSAFE_REDIRECT'));
  assert.ok(codes(result).includes('REDIRECT_TARGET_MISMATCH'));
  assert.equal(result.counts.sitemapUrls, 2);
});

test('invalid per-response headers produce an incomplete report instead of rejecting the audit', async () => {
  const report = fixtureReport();
  const normal = fakeFetch(routes(report));
  const fetchImpl = async (url, options) =>
    new URL(url).pathname === catalogPath
      ? {
          status: 200,
          headers: {
            get() {
              throw new Error('Bad header');
            },
          },
        }
      : normal(url, options);
  const result = await auditInstructionTaxonomyHttp({ report, fetchImpl });
  assert.equal(result.complete, false);
  assert.ok(
    result.issues.some(
      issue => issue.code === 'HTTP_REQUEST_FAILED' && issue.detail === 'Bad header',
    ),
  );
  assert.equal(result.counts.sitemapUrls, 2);
});
