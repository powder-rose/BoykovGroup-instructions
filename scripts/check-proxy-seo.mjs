import assert from 'node:assert/strict';
import http from 'node:http';

const [baseUrl] = process.argv.slice(2);
assert.ok(baseUrl, 'Usage: node scripts/check-proxy-seo.mjs http://127.0.0.1:18082');
assert.equal(new URL(baseUrl).protocol, 'http:', 'Probe the inner HTTP proxy directly');

function get(path, protocol) {
  const headers = { Host: 'boykovdocs.ru' };
  if (protocol !== undefined) headers['X-Forwarded-Proto'] = protocol;
  // Preserve the public Host header while connecting to the loopback test port.
  return new Promise((resolve, reject) => {
    const request = http.get(
      new URL(path, baseUrl),
      { headers, signal: AbortSignal.timeout(10000) },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => (text += chunk));
        response.on('error', reject);
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`${path}: expected HTTP 200, received ${response.statusCode}`));
          } else resolve(text);
        });
      },
    );
    request.on('error', reject);
  });
}

// Run against the inner proxy in an isolated runtime with SITE_URL unset.
// An explicit canonical origin intentionally takes precedence over request headers.
for (const [header, expected] of [
  ['https', 'https'],
  ['http', 'http'],
  [undefined, 'http'],
  ['https, http', 'http'],
  ['invalid', 'http'],
]) {
  const sitemap = await get('/sitemap.xml', header);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(match => match[1]);
  assert.ok(locations.length >= 2, 'Sitemap must contain home and the instruction catalog');
  assert.equal(locations[0], `${expected}://boykovdocs.ru/`, 'Incorrect homepage scheme');

  const robots = await get('/robots.txt', header);
  assert.ok(
    robots.includes(`Sitemap: ${expected}://boykovdocs.ru/sitemap.xml`),
    'Incorrect sitemap directive in robots.txt',
  );

  if (expected === 'https') {
    for (const location of locations) {
      const url = new URL(location);
      assert.equal(url.origin, 'https://boykovdocs.ru', location);
    }
    const paths = ['/instrukcii-po-ohrane-truda'];
    const instruction = locations.find(location =>
      new URL(location).pathname.startsWith('/instrukciya-po-ohrane-truda/'),
    );
    if (instruction) paths.push(new URL(instruction).pathname);
    for (const path of paths) {
      const html = await get(path, header);
      const canonicalTag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/iu)?.[0];
      const canonicalUrl = canonicalTag?.match(/\bhref=["']([^"']+)["']/iu)?.[1];
      assert.equal(canonicalUrl, `https://boykovdocs.ru${path}`, `${path}: incorrect canonical`);
    }
  }
  console.log(`PROXY_SEO_PROTOCOL=${header ?? 'absent'} EXPECTED=${expected} OK`);
}
