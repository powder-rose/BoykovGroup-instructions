import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-registry-http-'));
  const filePath = path.join(directory, 'runtime', 'taxonomy.json');
  const draftsDirectory = path.join(directory, 'drafts');
  const instructions = new InstructionsRepository(path.join(directory, 'published'));
  const editor = createInstructionEditorService({
    repository: instructions,
    draftsDirectory,
    saveSnapshot: () => {},
  });
  const repository = createInstructionTaxonomyRegistryRepository({ filePath });
  const service = createInstructionTaxonomyRegistryService({
    repository,
    getInstructions: () => editor.getTaxonomyReferences(),
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: 'test-user' };
    next();
  });
  app.use('/api/admin/instruction-taxonomy', createAdminInstructionTaxonomyRouter({ service }));
  app.use((error, _req, res, _next) => {
    res.status(error.status ?? 500).json({ error: 'Не удалось выполнить запрос' });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/instruction-taxonomy`;
  const request = (suffix = '', { method = 'GET', role = 'admin', body } = {}) =>
    fetch(base + suffix, {
      method,
      headers: {
        ...(role ? { 'x-test-role': role } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const draft = value => {
    fs.mkdirSync(draftsDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(draftsDirectory, `${Buffer.from(value.id).toString('base64url')}.json`),
      JSON.stringify({ revision: 1, ...value, status: 'draft' }),
    );
  };
  return { directory, filePath, draftsDirectory, instructions, editor, repository, request, draft };
}

const tag = { code: 'T99', name: 'Новая тема', slug: 'novaya-tema' };

test('every registry HTTP operation requires admin authorization and disables caching', async t => {
  const f = await fixture(t);
  for (const role of [null, 'user', 'guest']) {
    for (const [suffix, method, body] of [
      ['', 'GET', undefined],
      ['/section/W01/usage', 'GET', undefined],
      ['/tag', 'POST', { entity: tag, expectedRevision: 0 }],
      ['/tag/T01', 'PUT', { patch: { name: 'Forbidden' }, expectedRevision: 0 }],
      ['/tag/T01', 'DELETE', { expectedRevision: 0 }],
    ]) {
      const response = await f.request(suffix, { role, method, body });
      assert.equal(response.status, 401, `${role ?? 'anonymous'} ${method} ${suffix}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      await response.arrayBuffer();
    }
  }
  assert.equal(f.repository.read().revision, 0);
  assert.equal(fs.existsSync(path.dirname(f.filePath)), false);
});

test('admin reads the source registry and usage without initializing persistent storage', async t => {
  const f = await fixture(t);
  const response = await f.request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { registry } = await response.json();
  assert.equal(registry.revision, 0);
  assert.equal(registry.catalogs.length, 2);
  assert.equal(registry.sections.length, 52);
  assert.equal(registry.tags.length, 79);
  assert.equal(Object.hasOwn(registry, 'legacyCatalog'), false);
  const usage = await f.request('/section/W01/usage');
  assert.equal(usage.status, 200);
  assert.deepEqual(await usage.json(), { usage: { references: 0, publishedInstructions: 0 } });
  assert.equal(fs.existsSync(path.dirname(f.filePath)), false);
});

test('HTTP create, edit and delete return saved revisions and preserve independent SEO fields', async t => {
  const f = await fixture(t);
  const created = await f.request('/tag', {
    method: 'POST',
    body: { entity: tag, expectedRevision: 0 },
  });
  assert.equal(created.status, 201);
  const first = (await created.json()).registry;
  assert.equal(first.revision, 1);
  assert.equal(first.tags.length, 80);
  const patch = {
    name: 'Название темы',
    h1: 'Отдельный H1',
    seoTitle: 'Отдельный Title',
    seoDescription: 'Отдельное описание',
    canonicalUrl: 'https://example.test/topic/',
    introContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Вступление.' }] }],
    },
    seoContent: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Подзаголовок' }] },
      ],
    },
    sortOrder: 50,
  };
  const edited = await f.request('/tag/T99', {
    method: 'PUT',
    body: { patch, expectedRevision: 1 },
  });
  assert.equal(edited.status, 200);
  const second = (await edited.json()).registry;
  assert.equal(second.revision, 2);
  const saved = second.tags.find(item => item.code === tag.code);
  for (const [key, value] of Object.entries(patch)) assert.deepEqual(saved[key], value);
  assert.equal(saved.status, 'draft');
  assert.equal(saved.indexingEnabled, false);
  assert.deepEqual(f.repository.read(), second);
  const removed = await f.request('/tag/T99', {
    method: 'DELETE',
    body: { expectedRevision: 2 },
  });
  assert.equal(removed.status, 200);
  const third = (await removed.json()).registry;
  assert.equal(third.revision, 3);
  assert.equal(third.tags.length, 79);
  assert.equal(
    third.tags.some(item => item.code === tag.code),
    false,
  );
});

test('root and catalog editing use the same metadata contract; child sections prevent catalog deletion', async t => {
  const f = await fixture(t);
  const createdCatalog = await f.request('/catalog', {
    method: 'POST',
    body: {
      expectedRevision: 0,
      entity: { code: 'H99', name: 'Новый каталог', slug: 'novyj-katalog' },
    },
  });
  assert.equal(createdCatalog.status, 201);
  await createdCatalog.arrayBuffer();
  const createdSection = await f.request('/section', {
    method: 'POST',
    body: {
      expectedRevision: 1,
      entity: { code: 'W99', name: 'Новый раздел', slug: 'novyj-razdel', parentCode: 'H99' },
    },
  });
  assert.equal(createdSection.status, 201);
  await createdSection.arrayBuffer();
  const occupied = await f.request('/catalog/H99', {
    method: 'DELETE',
    body: { expectedRevision: 2 },
  });
  assert.equal(occupied.status, 400);
  assert.deepEqual((await occupied.json()).details, { references: 0, sections: ['W99'] });
  const moved = await f.request('/section/W99', {
    method: 'PUT',
    body: { expectedRevision: 2, patch: { parentCode: 'H02' } },
  });
  assert.equal(moved.status, 200);
  await moved.arrayBuffer();
  const removed = await f.request('/catalog/H99', {
    method: 'DELETE',
    body: { expectedRevision: 3 },
  });
  assert.equal(removed.status, 200);
  await removed.arrayBuffer();
  const root = await f.request('/root/ROOT', {
    method: 'PUT',
    body: { expectedRevision: 4, patch: { h1: 'Общий каталог инструкций' } },
  });
  assert.equal(root.status, 200);
  assert.equal((await root.json()).registry.root.h1, 'Общий каталог инструкций');
});

test('malformed mutation envelopes and immutable metadata are rejected without partial writes', async t => {
  const f = await fixture(t);
  for (const expectedRevision of [undefined, null, -1, 0.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
    const response = await f.request('/tag', {
      method: 'POST',
      body: { entity: tag, expectedRevision },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_REVISION');
  }
  for (const body of [null, [], { entity: tag, expectedRevision: 0, routeApproved: true }]) {
    const response = await f.request('/tag', { method: 'POST', body });
    assert.equal(response.status, 400);
    await response.arrayBuffer();
  }
  for (const patch of [
    { code: 'T99' },
    { kind: 'section' },
    { source: {} },
    { routeApproved: true },
  ]) {
    const response = await f.request('/tag/T01', {
      method: 'PUT',
      body: { patch, expectedRevision: 0 },
    });
    assert.equal(response.status, 400);
    await response.arrayBuffer();
  }
  assert.equal(f.repository.read().revision, 0);
  assert.equal(fs.existsSync(f.filePath), false);
});

test('stale HTTP mutations report a conflict and leave the latest registry untouched', async t => {
  const f = await fixture(t);
  const created = await f.request('/tag', {
    method: 'POST',
    body: { entity: tag, expectedRevision: 0 },
  });
  assert.equal(created.status, 201);
  await created.arrayBuffer();
  const bytes = fs.readFileSync(f.filePath);
  for (const [suffix, method, body] of [
    ['/tag/T99', 'PUT', { patch: { h1: 'Stale' }, expectedRevision: 0 }],
    ['/tag/T99', 'DELETE', { expectedRevision: 0 }],
    ['/tag', 'POST', { entity: { ...tag, code: 'T98', slug: 'stale' }, expectedRevision: 0 }],
  ]) {
    const response = await f.request(suffix, { method, body });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'TAXONOMY_REVISION_CONFLICT');
    assert.deepEqual(fs.readFileSync(f.filePath), bytes);
  }
});

test('usage and deletion retain published originals and all saved drafts, including older overlays', async t => {
  const f = await fixture(t);
  f.instructions.save({
    id: 'same-instruction',
    revision: 3,
    title: 'Public original',
    instructionContent: { type: 'doc', content: [] },
    primaryCategoryId: 'W01',
    tagIds: ['T01'],
  });
  f.draft({ id: 'same-instruction', primaryCategoryId: 'W02', tagIds: ['T02'] });
  const references = f.editor.getTaxonomyReferences();
  assert.equal(references.length, 2);
  assert.equal(
    references.some(item => Object.hasOwn(item, 'instructionContent')),
    false,
  );
  assert.equal(
    references.some(item => Object.hasOwn(item, 'title')),
    false,
  );
  references[0].tagIds.push('T03');
  assert.deepEqual(f.instructions.getById('same-instruction').tagIds, ['T01']);
  for (const [kind, code, publishedInstructions] of [
    ['root', 'ROOT', 1],
    ['catalog', 'H02', 1],
    ['section', 'W01', 1],
    ['section', 'W02', 0],
    ['tag', 'T01', 1],
    ['tag', 'T02', 0],
  ]) {
    const response = await f.request(`/${kind}/${code}/usage`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      usage: { references: 1, publishedInstructions },
    });
  }
  for (const [kind, code] of [
    ['section', 'W01'],
    ['section', 'W02'],
    ['tag', 'T01'],
    ['tag', 'T02'],
  ]) {
    const response = await f.request(`/${kind}/${code}`, {
      method: 'DELETE',
      body: { expectedRevision: 0 },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'TAXONOMY_ENTITY_IN_USE');
    assert.equal(body.details.references, 1);
  }
  assert.equal(fs.existsSync(f.filePath), false);
  assert.deepEqual(f.instructions.getById('same-instruction').tagIds, ['T01']);
  assert.equal(f.editor.getTaxonomyReferences().length, 2);
});

test('unreadable saved drafts fail usage, deletion and indexed publication closed', async t => {
  const f = await fixture(t);
  f.draft({ id: 'corrupt', primaryCategoryId: 'W01', tagIds: ['T01'] });
  fs.writeFileSync(path.join(f.draftsDirectory, 'broken.json'), '{');
  t.mock.method(console, 'error', () => {});
  for (const [suffix, method, body] of [
    ['/section/W01/usage', 'GET', undefined],
    ['/section/W01', 'DELETE', { expectedRevision: 0 }],
    [
      '/section/W01',
      'PUT',
      { expectedRevision: 0, patch: { status: 'published', indexingEnabled: true } },
    ],
  ]) {
    const response = await f.request(suffix, { method, body });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'INSTRUCTION_DRAFT_STORAGE_ERROR');
  }
  assert.equal(fs.existsSync(f.filePath), false);
  assert.equal(f.repository.read().revision, 0);
});

test('unknown kinds and codes return 404 while protected operations and empty indexing remain invalid', async t => {
  const f = await fixture(t);
  for (const suffix of ['/constructor/W01/usage', '/section/MISSING/usage']) {
    const response = await f.request(suffix);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'TAXONOMY_ENTITY_NOT_FOUND');
  }
  for (const [suffix, method, body] of [
    ['/root', 'POST', { expectedRevision: 0, entity: tag }],
    ['/root/ROOT', 'DELETE', { expectedRevision: 0 }],
    ['/catalog/H01', 'PUT', { expectedRevision: 0, patch: { status: 'published' } }],
    ['/section/P01', 'PUT', { expectedRevision: 0, patch: { status: 'published' } }],
    [
      '/section/W01',
      'PUT',
      { expectedRevision: 0, patch: { status: 'published', indexingEnabled: true } },
    ],
  ]) {
    const response = await f.request(suffix, { method, body });
    assert.equal(response.status, 400);
    await response.arrayBuffer();
  }
  assert.equal(fs.existsSync(f.filePath), false);
  assert.equal(f.repository.read().revision, 0);
});
