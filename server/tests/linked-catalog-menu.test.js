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
      import Filters from './src/components/InstructionCatalog/CatalogTaxonomyFilters.jsx';
      export { getInstructionTaxonomyFilters } from './src/api/instructionsApi.js';
      export function render(props) { return renderToStaticMarkup(<Filters {...props} />); }
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
const { render, getInstructionTaxonomyFilters } = clientRequire(bundle);

const options = {
  catalogs: [
    { id: 'H01', count: 3 },
    { id: 'H02', count: 2 },
  ],
  categories: [
    { id: 'P06', label: 'Инженеры', count: 3, catalogId: 'H01' },
    { id: 'W02', label: 'Электромонтаж', count: 2, catalogId: 'H02' },
  ],
  tags: [{ id: 'T35', label: 'Электробезопасность', count: 1 }],
};

test('catalog cards disclose the connected menu and hide it when all instructions are selected', () => {
  const collapsed = render({ options, catalogId: '', category: '', tag: '' });
  assert.match(collapsed, /role="region"[^>]*hidden=""/u);
  assert.doesNotMatch(collapsed, /<select|role="combobox"/u);
  const expanded = render({ options, catalogId: 'H01', category: 'P06', tag: '' });
  const panelId = expanded.match(/aria-expanded="true" aria-controls="([^"]+)"/u)?.[1];
  assert.ok(panelId);
  assert.ok(expanded.includes(`id="${panelId}"`));
  assert.ok(expanded.includes(`aria-labelledby="${panelId}-H01"`));
  assert.match(expanded, /<option value="P06"/u);
  assert.doesNotMatch(expanded, /<option value="W02"/u);
  assert.match(expanded, /role="combobox"/u);
  assert.match(expanded, /Сбросить фильтры/u);
});

test('legacy filter links still disclose the menu and loading cannot select stale tags', () => {
  const legacy = render({ options, catalogId: '', category: 'P06', tag: '' });
  assert.match(legacy, /<select/u);
  assert.doesNotMatch(legacy, /hidden=""/u);
  const loading = render({ options, catalogId: 'H02', category: '', tag: '', loading: true });
  assert.match(loading, /aria-busy="true"/u);
  assert.match(loading, /<input(?=[^>]*role="combobox")(?=[^>]*disabled="")[^>]*>/u);
  assert.match(loading, /Загрузка разделов и тегов/u);
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
