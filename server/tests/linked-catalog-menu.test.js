import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import { updateInstructionFilterParams } from '../../client/src/components/InstructionCatalog/instructionFilterParams.js';

const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-linked-menu-'));
const bundle = path.join(directory, 'menu.cjs');
after(() => fs.rmSync(directory, { recursive: true, force: true }));
await clientRequire('esbuild').build({
  stdin: {
    contents: `
      import { renderToStaticMarkup } from 'react-dom/server';
      import { StaticRouter } from 'react-router-dom';
      import Filters from './src/components/InstructionCatalog/CatalogTaxonomyFilters.jsx';
      import Navigation from './src/components/TaxonomyLandingPage/TaxonomyNavigation.jsx';
      import Toolbar from './src/components/InstructionCatalog/InstructionResultsToolbar.jsx';
      export { default as Sort } from './src/components/InstructionSort/InstructionSort.jsx';
      export { getInstructionTaxonomyFilters } from './src/api/instructionsApi.js';
      export function render(props) { return renderToStaticMarkup(<StaticRouter location="/"><Filters {...props} /></StaticRouter>); }
      export function renderToolbar(props) { return renderToStaticMarkup(<Toolbar {...props} />); }
      export function renderNavigation(props) { return renderToStaticMarkup(<StaticRouter location="/"><Navigation {...props} /></StaticRouter>); }
    `,
    resolveDir: fileURLToPath(new URL('../../client/', import.meta.url)),
    loader: 'jsx',
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
});
const { render, renderNavigation, renderToolbar, Sort, getInstructionTaxonomyFilters } =
  clientRequire(bundle);

const options = {
  catalogs: [
    { id: 'H01', count: 3 },
    { id: 'H02', count: 2 },
  ],
  categories: [
    { id: 'P06', label: 'Инженеры', count: 3, catalogId: 'H01', path: '/section/P06/' },
    { id: 'W02', label: 'Электромонтаж', count: 2, catalogId: 'H02', path: '/section/W02/' },
  ],
  tags: [{ id: 'T35', label: 'Электробезопасность', count: 1 }],
};

test('catalog mode buttons disclose the connected menu and hide it when all instructions are selected', () => {
  const collapsed = render({ options, catalogId: '', category: '', tag: '' });
  assert.match(collapsed, /role="region"[^>]*hidden=""/u);
  assert.doesNotMatch(collapsed, /<select|role="combobox"/u);
  const expanded = render({ options, catalogId: 'H01', category: 'P06', tag: '' });
  const panelId = expanded.match(/aria-expanded="true" aria-controls="([^"]+)"/u)?.[1];
  assert.ok(panelId);
  assert.ok(expanded.includes(`id="${panelId}"`));
  assert.ok(expanded.includes(`aria-labelledby="${panelId}-H01"`));
  assert.match(expanded, /value="Инженеры"/u);
  assert.doesNotMatch(expanded, /Электромонтаж/u);
  assert.equal((expanded.match(/role="combobox"/gu) || []).length, 2);
  assert.doesNotMatch(expanded, /role="listbox"/u);
  assert.match(expanded, /Сбросить фильтры/u);
});

test('legacy filter links still disclose the menu and loading cannot select stale tags', () => {
  const legacy = render({ options, catalogId: '', category: 'P06', tag: '' });
  assert.match(legacy, /value="Инженеры"/u);
  assert.doesNotMatch(legacy, /hidden=""/u);
  const loading = render({ options, catalogId: 'H02', category: '', tag: '', loading: true });
  assert.match(loading, /aria-busy="true"/u);
  assert.match(loading, /<input(?=[^>]*role="combobox")(?=[^>]*disabled="")[^>]*>/u);
  assert.match(loading, /Загрузка разделов и тегов/u);
  assert.equal((loading.match(/<input(?=[^>]*disabled="")[^>]*>/gu) || []).length, 2);
});

test('quick choices are bounded, scoped, and keep an active less common section visible', () => {
  const categories = Array.from({ length: 24 }, (_, index) => ({
    id: `P${index}`,
    label: `Профессия ${index}`,
    path: `/section/P${index}/`,
    count: 24 - index,
    catalogId: 'H01',
  }));
  const markup = render({
    options: { ...options, categories: [...categories, options.categories[1]] },
    catalogId: 'H01',
    category: 'P23',
    tag: '',
  });
  const quick = markup.match(
    /<nav[^>]*aria-label="Страницы разделов"[^>]*>([\s\S]*?)<\/nav>/u,
  )?.[1];
  assert.ok(quick);
  assert.equal((quick.match(/<a\b/gu) || []).length, 8);
  assert.doesNotMatch(quick, /<button|aria-pressed|disabled/u);
  assert.match(quick, /href="\/section\/P23\/"[^>]*><span>Профессия 23</u);
  assert.match(quick, /Профессия 0</u);
  assert.doesNotMatch(quick, /Электромонтаж/u);
  const work = render({ options, catalogId: 'H02', category: '', tag: '' });
  assert.match(work, /Электромонтаж/u);
  assert.doesNotMatch(work, /Инженеры/u);
});

test('section shortcuts require a published path and remain navigable during filter loading', () => {
  const unpublished = {
    id: 'P99',
    label: 'Неопубликованный раздел',
    count: 100,
    catalogId: 'H01',
  };
  const markup = render({
    options: { ...options, categories: [...options.categories, unpublished] },
    catalogId: 'H01',
    category: 'P99',
    tag: '',
    loading: true,
  });
  const quick = markup.match(
    /<nav[^>]*aria-label="Страницы разделов"[^>]*>([\s\S]*?)<\/nav>/u,
  )?.[1];
  assert.ok(quick);
  assert.match(quick, /href="\/section\/P06\/"/u);
  assert.doesNotMatch(quick, /Неопубликованный раздел|P99|disabled|<button/u);
  assert.match(markup, /value="Неопубликованный раздел"/u);
  assert.match(markup, /role="combobox"/u);
});

test('compact directory keeps every ordinary link inside a closed native disclosure', () => {
  const catalogs = [
    {
      code: 'H01',
      name: 'Профессии',
      path: '/catalog/H01/',
      count: 3,
      sections: [{ code: 'P06', name: 'Инженеры', path: '/section/P06/', count: 3 }],
    },
  ];
  const tags = [{ code: 'T35', name: 'Электробезопасность', path: '/topic/T35/', count: 1 }];
  const compact = renderNavigation({ catalogs, tags, compact: true });
  assert.match(compact, /^<details[^>]*><summary>Все разделы и темы<\/summary>/u);
  assert.doesNotMatch(compact, /<details[^>]*\bopen\b/u);
  for (const path of ['/catalog/H01/', '/section/P06/', '/topic/T35/']) {
    assert.ok(compact.includes(`href="${path}"`), path);
  }
  const full = renderNavigation({ sections: catalogs[0].sections });
  assert.doesNotMatch(full, /<details/u);
  assert.ok(full.includes('href="/section/P06/"'));
});

test('published catalog, category and tag pages are exposed as ordinary links beside the filters', () => {
  const published = {
    catalogs: options.catalogs.map(item => ({
      ...item,
      label: item.id,
      path: `/catalog/${item.id}/`,
    })),
    categories: options.categories.map(item => ({ ...item, path: `/section/${item.id}/` })),
    tags: options.tags.map(item => ({ ...item, path: `/topic/${item.id}/` })),
  };
  const markup = render({ options: published, catalogId: 'H01', category: 'P06', tag: 'T35' });
  for (const path of ['/catalog/H01/', '/catalog/H02/', '/section/P06/', '/topic/T35/']) {
    assert.ok(markup.includes(`href="${path}"`), path);
  }
  assert.ok(!markup.includes('href="/section/W02/"'));
});

test('one control panel groups all modes, scoped filters, and a single complete directory', () => {
  const navigation = {
    catalogs: [
      {
        code: 'H01',
        name: 'Профессии',
        path: '/catalog/H01/',
        count: 3,
        sections: [{ code: 'P06', name: 'Инженеры', path: '/section/P06/', count: 3 }],
      },
    ],
    tags: [{ code: 'T35', name: 'Электробезопасность', path: '/topic/T35/', count: 1 }],
  };
  const markup = render({ options, navigation, catalogId: 'H01', category: '', tag: '' });
  const modes = markup.match(
    /role="group" aria-label="Направление поиска">([\s\S]*?)<\/div>/u,
  )?.[1];
  assert.ok(modes);
  assert.equal((modes.match(/<button\b/gu) || []).length, 3);
  for (const label of ['Все инструкции', 'По профессиям', 'По видам работ']) {
    assert.ok(modes.includes(label), label);
  }
  assert.equal((modes.match(/aria-pressed="true"/gu) || []).length, 1);
  assert.equal((markup.match(/<details\b/gu) || []).length, 1);
  for (const path of ['/catalog/H01/', '/section/P06/', '/topic/T35/']) {
    assert.ok(markup.includes(`href="${path}"`), path);
  }
  assert.doesNotMatch(markup, /Все профессии и должности|Все виды работ →/u);
});

test('shared result toolbar contains one localized count and one sort group', () => {
  const previous = globalThis.window;
  globalThis.window = { location: { search: '?sort=popular' } };
  try {
    const markup = renderToolbar({ total: 2201, filtered: true });
    assert.match(markup, /Найдено инструкций: 2\s201/u);
    assert.equal((markup.match(/aria-label="Сортировка инструкций"/gu) || []).length, 1);
    assert.equal((markup.match(/<button\b/gu) || []).length, 2);
    assert.match(markup, /aria-pressed="true"[^>]*>Популярные<\/button>/u);
    assert.doesNotMatch(markup, /На главную/u);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('inline sorting preserves query and taxonomy scope while resetting pagination', () => {
  const previous = globalThis.window;
  let destination;
  globalThis.window = {
    location: {
      search: '?q=электрик&catalog=H01&category=P06&tag=T06&page=4',
      href: 'https://boykovdocs.ru/instrukcii-po-ohrane-truda?q=электрик&catalog=H01&category=P06&tag=T06&page=4#results',
      assign: value => {
        destination = value;
      },
    },
  };
  try {
    const buttons = Sort({ compact: true }).props.children.props.children;
    buttons.find(button => button.props.children === 'Сначала новые').props.onClick();
    assert.equal(destination, undefined);
    buttons.find(button => button.props.children === 'Популярные').props.onClick();
    const next = new URL(destination, 'https://boykovdocs.ru');
    assert.equal(next.pathname, '/instrukcii-po-ohrane-truda');
    assert.equal(next.searchParams.get('q'), 'электрик');
    assert.equal(next.searchParams.get('catalog'), 'H01');
    assert.equal(next.searchParams.get('category'), 'P06');
    assert.equal(next.searchParams.get('tag'), 'T06');
    assert.equal(next.searchParams.get('sort'), 'popular');
    assert.equal(next.searchParams.has('page'), false);
    assert.equal(next.hash, '#results');
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('catalog and category transitions clear dependent filters while preserving search and sort', () => {
  const current = new URLSearchParams(
    'q=электрик&catalog=H01&category=P06&tag=T06&page=4&sort=popular',
  );
  const next = updateInstructionFilterParams(current, { catalog: 'H02' });
  assert.equal(next.get('catalog'), 'H02');
  assert.equal(next.get('q'), 'электрик');
  assert.equal(next.get('sort'), 'popular');
  for (const key of ['category', 'tag', 'page']) assert.equal(next.has(key), false);
  const category = updateInstructionFilterParams(current, { category: 'P10' });
  assert.equal(category.get('catalog'), 'H01');
  assert.equal(category.get('category'), 'P10');
  assert.equal(category.has('tag'), false);
  const reset = updateInstructionFilterParams(current, { category: '', tag: '' });
  assert.equal(reset.get('catalog'), 'H01');
  const all = updateInstructionFilterParams(current, { catalog: '' });
  for (const key of ['catalog', 'category', 'tag', 'page']) assert.equal(all.has(key), false);
  const query = updateInstructionFilterParams(current, { q: 'водитель' });
  assert.equal(query.get('category'), 'P06');
  assert.equal(query.get('tag'), 'T06');
  assert.equal(current.get('page'), '4');
});

test('filter metadata requests send their catalog and category and support cancellation', async t => {
  const controller = new AbortController();
  let call;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    call = { url: new URL(url, 'https://example.test'), init };
    return Response.json(options);
  });
  assert.deepEqual(
    await getInstructionTaxonomyFilters({
      catalogId: 'H02',
      category: 'W02',
      signal: controller.signal,
    }),
    options,
  );
  assert.equal(call.url.pathname, '/api/instructions/taxonomy-filters');
  assert.equal(call.url.searchParams.get('catalog'), 'H02');
  assert.equal(call.url.searchParams.get('category'), 'W02');
  assert.equal(call.init.cache, 'no-store');
  assert.equal(call.init.signal, controller.signal);
});
