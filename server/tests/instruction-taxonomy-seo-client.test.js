import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPageMetadata,
  applyPendingTaxonomyPolicy,
} from '../../client/src/lib/pageMetadata.js';
import { createInstructionTaxonomySeoSchema } from '../src/shared/instructionTaxonomySeo.js';

function documentFixture() {
  const elements = [];
  const document = {
    title: 'SSR title',
    head: {
      append(element) {
        elements.push(element);
      },
      querySelector(selector) {
        const [, tag, attribute, value] = selector.match(/^(\w+)\[([\w-]+)(?:="([^"]*)")?\]$/u);
        return (
          elements.find(
            element =>
              element.tag === tag &&
              element.getAttribute(attribute) !== null &&
              (value === undefined || element.getAttribute(attribute) === value),
          ) || null
        );
      },
    },
    createElement(tag) {
      const attributes = new Map();
      return {
        tag,
        textContent: '',
        setAttribute(key, value) {
          attributes.set(key, String(value));
        },
        getAttribute(key) {
          return attributes.get(key) ?? null;
        },
        removeAttribute(key) {
          attributes.delete(key);
        },
        remove() {
          const index = elements.indexOf(this);
          if (index >= 0) elements.splice(index, 1);
        },
      };
    },
  };
  function append(tag, attributes, content = '') {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    element.textContent = content;
    document.head.append(element);
    return element;
  }
  return { document, elements, append };
}

function metadata(overrides = {}) {
  return {
    title: 'Section title',
    description: 'Stored description',
    canonicalUrl:
      'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-vidam-rabot/raboty-na-vysote/',
    robotsValue: 'noindex, follow',
    serializedSchema: '{"@type":"CollectionPage"}',
    enhancedMetadata: true,
    ...overrides,
  };
}

test('shared page schema uses the configured site origin independently of a custom canonical', () => {
  const page = {
    siteUrl: 'https://boykovdocs.ru',
    path: '/instrukcii-po-ohrane-truda/temy/topic/',
    h1: 'Stored H1',
    seo: { canonicalUrl: 'https://canonical.example/topic/', description: 'Stored description' },
    breadcrumbs: [
      { name: 'Главная', path: '/' },
      { name: 'Stored topic', path: null },
    ],
  };
  const schema = createInstructionTaxonomySeoSchema(page, { origin: 'http://localhost:5173' });
  assert.equal(schema['@graph'][0]['@id'], 'https://boykovdocs.ru/#website');
  assert.equal(schema['@graph'][1].url, page.seo.canonicalUrl);
  assert.deepEqual(
    schema['@graph'][2].itemListElement.map(item => item.item),
    ['https://boykovdocs.ru/', 'https://boykovdocs.ru/instrukcii-po-ohrane-truda/temy/topic/'],
  );
});

test('head updates adopt the SSR taxonomy schema once and remove only owned metadata on exit', () => {
  const f = documentFixture();
  const existing = f.append(
    'script',
    { type: 'application/ld+json', 'data-taxonomy-seo': '' },
    '{"@type":"OldPage"}',
  );
  const unrelated = f.append(
    'script',
    { type: 'application/ld+json', 'data-site-organization': '' },
    '{"@type":"Organization"}',
  );
  f.append('link', { rel: 'canonical', href: 'https://boykovdocs.ru/old/' });
  f.append('meta', { name: 'description', content: 'SSR description' });
  const cleanup = applyPageMetadata(metadata(), f.document);
  assert.equal(f.document.head.querySelector('script[data-taxonomy-seo]'), existing);
  assert.equal(
    f.elements.filter(item => item.getAttribute('data-taxonomy-seo') !== null).length,
    1,
  );
  assert.equal(existing.textContent, '{"@type":"CollectionPage"}');
  assert.equal(f.document.title, 'Section title');
  assert.equal(
    f.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'noindex, follow',
  );
  cleanup();
  assert.equal(f.document.head.querySelector('script[data-taxonomy-seo]'), null);
  assert.equal(f.document.head.querySelector('script[data-site-organization]'), unrelated);
  assert.equal(f.document.head.querySelector('link[rel="canonical"]'), null);
  assert.equal(f.document.head.querySelector('meta[property="og:url"]'), null);
  assert.equal(
    f.document.head.querySelector('meta[name="description"]').getAttribute('content'),
    'SSR description',
  );
});

test('taxonomy to legacy and home transitions cannot retain a taxonomy canonical, robots or graph', () => {
  const f = documentFixture();
  const leaveTaxonomy = applyPageMetadata(metadata(), f.document);
  leaveTaxonomy();
  const leaveLegacy = applyPageMetadata(
    metadata({
      title: 'Existing payment title',
      canonicalUrl: 'https://boykovdocs.ru/',
      robotsValue: 'noindex, nofollow',
      serializedSchema: null,
      enhancedMetadata: false,
    }),
    f.document,
  );
  assert.equal(
    f.document.head.querySelector('link[rel="canonical"]').getAttribute('href'),
    'https://boykovdocs.ru/',
  );
  assert.equal(
    f.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'noindex, nofollow',
  );
  assert.equal(f.document.head.querySelector('meta[property="og:url"]'), null);
  assert.equal(f.document.head.querySelector('script[data-taxonomy-seo]'), null);
  leaveLegacy();
  const leaveHome = applyPageMetadata(
    metadata({
      canonicalUrl: 'https://boykovdocs.ru/',
      robotsValue: 'index, follow',
      serializedSchema: null,
    }),
    f.document,
  );
  assert.equal(
    f.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'index, follow',
  );
  assert.equal(
    f.document.head.querySelector('meta[property="og:url"]').getAttribute('content'),
    'https://boykovdocs.ru/',
  );
  leaveHome();
});

test('root navigation loading preserves SSR robots and failures stay conservative without replacing editorial metadata', () => {
  const f = documentFixture();
  const robots = f.append('meta', { name: 'robots', content: 'noindex, follow' });
  f.append('script', {
    'data-taxonomy-seo': '',
    'data-taxonomy-path': '/instrukcii-po-ohrane-truda',
  });
  f.append('meta', { name: 'description', content: 'Stored root description' });
  const releaseLoading = applyPendingTaxonomyPolicy({}, f.document);
  assert.equal(robots.getAttribute('content'), 'noindex, follow');
  releaseLoading();
  robots.setAttribute('content', 'index, follow');
  const releaseKnownPolicy = applyPendingTaxonomyPolicy({}, f.document);
  assert.equal(robots.getAttribute('content'), 'index, follow');
  releaseKnownPolicy();
  const releaseFailure = applyPendingTaxonomyPolicy({ failed: true }, f.document);
  assert.equal(robots.getAttribute('content'), 'noindex, follow');
  assert.equal(f.document.title, 'SSR title');
  assert.equal(
    f.document.head.querySelector('meta[name="description"]').getAttribute('content'),
    'Stored root description',
  );
  releaseFailure();
  const unrelated = documentFixture();
  unrelated.append('meta', { name: 'robots', content: 'index, follow' });
  const releaseUnrelated = applyPendingTaxonomyPolicy({}, unrelated.document);
  assert.equal(
    unrelated.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'noindex, follow',
  );
  releaseUnrelated();
  unrelated.append('script', {
    'data-taxonomy-seo': '',
    'data-taxonomy-path': '/instrukcii-po-ohrane-truda/temy/topic/',
  });
  const releaseLanding = applyPendingTaxonomyPolicy({}, unrelated.document);
  assert.equal(unrelated.document.head.querySelector('script[data-taxonomy-seo]'), null);
  assert.equal(
    unrelated.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'noindex, follow',
  );
  releaseLanding();
  const empty = documentFixture();
  const releaseUnknown = applyPendingTaxonomyPolicy({}, empty.document);
  assert.equal(
    empty.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'noindex, follow',
  );
  releaseUnknown();
  const releaseConfirmedLegacy = applyPageMetadata(
    metadata({ robotsValue: 'index, follow' }),
    empty.document,
  );
  assert.equal(
    empty.document.head.querySelector('meta[name="robots"]').getAttribute('content'),
    'index, follow',
  );
  releaseConfirmedLegacy();
});
