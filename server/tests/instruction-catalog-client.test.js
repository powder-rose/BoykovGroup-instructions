import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test, { after } from 'node:test';

const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { build } = clientRequire('esbuild');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-catalog-client-'));
const bundle = path.join(directory, 'instructions.mjs');
after(() => fs.rmSync(directory, { recursive: true, force: true }));
await build({
  entryPoints: [
    fileURLToPath(new URL('../../client/src/store/instructionsSlice.js', import.meta.url)),
  ],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{}' },
});
const { instructionsReducer, searchInstructions } = await import(pathToFileURL(bundle));

function fixture(t) {
  let state = instructionsReducer(undefined, { type: 'test/init' });
  const pending = [];
  t.mock.method(
    globalThis,
    'fetch',
    url =>
      new Promise(resolve => {
        pending.push({ url: new URL(url, 'https://example.test'), resolve });
      }),
  );
  const dispatch = action => {
    state = instructionsReducer(state, action);
  };
  return {
    state: () => state,
    dispatch,
    pending,
    search: options => searchInstructions(options)(dispatch),
    resolve(index, ids, { page = 1, status = 200 } = {}) {
      pending[index].resolve(
        new Response(
          JSON.stringify(
            status === 200
              ? { items: ids.map(id => ({ id })), total: 8, page, totalPages: 4 }
              : { error: 'Older request failed' },
          ),
          {
            status,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    },
  };
}

test('a slower previous catalog cannot replace the current catalog results for the same query', async t => {
  const f = fixture(t);
  const old = f.search({ query: 'электрик', catalogId: 'H01' });
  const current = f.search({ query: 'электрик', catalogId: 'H02' });
  assert.equal(f.pending[0].url.searchParams.get('catalog'), 'H01');
  assert.equal(f.pending[1].url.searchParams.get('catalog'), 'H02');
  assert.equal(f.pending[1].url.searchParams.get('q'), 'электрик');
  f.resolve(1, ['work']);
  await current;
  f.resolve(0, ['role']);
  await old;
  assert.deepEqual(
    f.state().items.map(x => x.id),
    ['work'],
  );
  assert.equal(f.state().catalogId, 'H02');
  assert.equal(f.state().isSearching, false);
});

test('returning to a catalog accepts only its newest request and ignores stale errors', async t => {
  const f = fixture(t);
  const first = f.search({ catalogId: 'H01' });
  const second = f.search({ catalogId: 'H02' });
  const latest = f.search({ catalogId: 'H01' });
  f.resolve(2, ['latest-role']);
  await latest;
  f.resolve(1, [], { status: 500 });
  await second;
  f.resolve(0, ['old-role']);
  await first;
  assert.deepEqual(
    f.state().items.map(x => x.id),
    ['latest-role'],
  );
  assert.equal(f.state().searchError, null);
});

test('load more retains catalog scope and cannot append results from the previous catalog', async t => {
  const f = fixture(t);
  const previous = f.search({ catalogId: 'H02' });
  f.resolve(0, ['old-work']);
  await previous;
  const current = f.search({ catalogId: 'H01' });
  const staleAppend = f.search({ catalogId: 'H02', page: 2, append: true });
  f.resolve(2, ['old-work-page-two'], { page: 2 });
  await staleAppend;
  f.resolve(1, ['role-one']);
  await current;
  const more = f.search({ catalogId: 'H01', page: 2, append: true });
  assert.equal(f.pending[3].url.searchParams.get('catalog'), 'H01');
  assert.equal(f.pending[3].url.searchParams.get('page'), '2');
  f.resolve(3, ['role-one', 'role-two'], { page: 2 });
  await more;
  assert.deepEqual(
    f.state().items.map(x => x.id),
    ['role-one', 'role-two'],
  );
  assert.equal(f.state().page, 2);
  f.dispatch({ type: 'instructions/deleteSuccess', payload: 'old-work' });
  assert.equal(f.state().total, 8);
});
