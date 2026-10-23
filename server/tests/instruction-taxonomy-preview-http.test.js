import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionTaxonomyRouter } from '../src/routes/instructionTaxonomy.js';
import { InstructionEditorError } from '../src/services/instructionEditorError.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyEntityPath } from '../src/services/instructionTaxonomyRegistryModel.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const siteUrl = 'https://preview.fixture.boykovdocs.ru';
const richText = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function instruction(id, overrides = {}) {
  return {
    id,
    slug: `Instruction-${id}-AbC123`,
    title: `Инструкция ${id}`,
    status: 'published',
    primaryCategoryId: 'W01',
    tagIds: ['T47'],
    publishedAt: '2026-09-01T12:00:00.000Z',
    instructionContent: richText('PRIVATE_DOCUMENT_BODY'),
    editorialMeta: { seoAuthor: 'PRIVATE_EDITOR' },
    taxonomyMeta: { categorySource: 'manual', sourceFile: 'PRIVATE_SOURCE' },
    ...overrides,
  };
}

async function fixture(t, records = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-preview-http-'));
  const instructions = new InstructionsRepository(path.join(directory, 'instructions'));
  records.forEach(record => instructions.save(record));
  const filePath = path.join(directory, 'runtime', 'taxonomy.json');
  const registry = createInstructionTaxonomyRegistryRepository({ filePath });
  const service = createInstructionTaxonomyRegistryService({
    repository: registry,
    getInstructions: () => instructions.getAllFresh(),
  });
  const publicService = createInstructionTaxonomyPublicService({
    repository: instructions,
    taxonomyRepository: registry,
  });
  const calls = [];
  const previewService = {
    snapshot() {
      calls.push('snapshot');
      return publicService.snapshot();
    },
  };
  const app = express();
  app.set('query parser', 'extended');
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: 'test-user' };
    next();
  });
  app.use(
    '/api/admin/instruction-taxonomy',
    createAdminInstructionTaxonomyRouter({ service, previewService, origin: siteUrl }),
  );
  app.use(
    '/api/instruction-taxonomy',
    createInstructionTaxonomyRouter({ service: publicService, origin: siteUrl }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const request = (suffix, { role = 'admin', headers = {} } = {}) =>
    fetch(`${origin}/api/admin/instruction-taxonomy${suffix}`, {
      headers: { ...(role ? { 'x-test-role': role } : {}), ...headers },
      redirect: 'manual',
    });
  const update = (kind, code, patch) =>
    service.update(kind, code, patch, { expectedRevision: registry.read().revision });
  const entityPath = (kind, code) => getInstructionTaxonomyEntityPath(registry.read(), kind, code);
  return {
    directory,
    filePath,
    instructions,
    registry,
    publicService,
    previewService,
    calls,
    origin,
    request,
    update,
    entityPath,
  };
}

function privateResponse(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(response.headers.get('content-type'), /^application\/json/u);
}

test('saved page previews require the existing administrator authorization before reading any data', async t => {
  const f = await fixture(t);
  for (const role of [null, 'user', 'guest']) {
    for (const route of [
      '/root/ROOT/preview',
      '/catalog/H01/preview',
      '/section/W01/preview?q[]=x',
      '/tag/MISSING/preview',
    ]) {
      const response = await f.request(route, { role });
      assert.equal(response.status, 401);
      privateResponse(response);
      assert.deepEqual(await response.json(), { error: 'Требуется авторизация администратора' });
    }
  }
  assert.deepEqual(f.calls, []);
  assert.equal(fs.existsSync(f.filePath), false);
});

test('admins preview saved draft content and unresolved routes without publishing drafts', async t => {
  const f = await fixture(t, [instruction('live'), instruction('draft', { status: 'draft' })]);
  f.update('section', 'W01', {
    h1: 'Сохранённый заголовок',
    seoTitle: 'Отдельный SEO Title',
    seoDescription: 'Сохранённое описание',
    introContent: richText('Сохранённое вступление'),
    seoContent: richText('Сохранённый нижний текст'),
  });
  const before = fs.readFileSync(f.filePath);
  const originalDocument = fs.readFileSync(path.join(f.directory, 'instructions', 'live.json'));
  for (const [kind, code] of [
    ['root', 'ROOT'],
    ['catalog', 'H02'],
    ['section', 'W01'],
    ['tag', 'T47'],
    ['catalog', 'H01'],
    ['section', 'P01'],
  ]) {
    const response = await f.request(`/${kind}/${code}/preview`, {
      headers: { Host: 'untrusted.example', 'X-Forwarded-Host': 'forwarded.example' },
    });
    assert.equal(response.status, 200, `${kind}/${code}`);
    privateResponse(response);
    assert.equal(response.headers.get('location'), null);
    const { page } = await response.json();
    assert.equal(page.code, code);
    assert.equal(page.preview, true);
    assert.equal(page.entityStatus, 'draft');
    assert.equal(page.publicPath, kind === 'root' ? '/instrukcii-po-ohrane-truda' : null);
    assert.equal(page.siteUrl, siteUrl);
    assert.equal(page.seo.robots, 'noindex, nofollow');
    assert.equal(page.seo.indexable, false);
    const serialized = JSON.stringify(page);
    for (const privateValue of [
      'PRIVATE_DOCUMENT_BODY',
      'PRIVATE_EDITOR',
      'PRIVATE_SOURCE',
      'sourceIssues',
      'redirects',
      'untrusted.example',
      'forwarded.example',
    ])
      assert.equal(serialized.includes(privateValue), false, privateValue);
    if (code === 'H01' || code === 'P01') {
      assert.equal(page.path, null);
      assert.equal(page.routeApproved, false);
      assert.equal(page.seo.canonicalUrl, null);
    }
    if (code === 'W01') {
      assert.equal(page.h1, 'Сохранённый заголовок');
      assert.equal(page.seo.title, 'Отдельный SEO Title');
      assert.equal(page.seo.description, 'Сохранённое описание');
      assert.deepEqual(page.introContent, richText('Сохранённое вступление'));
      assert.deepEqual(page.seoContent, richText('Сохранённый нижний текст'));
      assert.equal(page.total, 1);
      assert.deepEqual(
        page.items.map(item => item.id),
        ['live'],
      );
    }
    if (kind !== 'root') {
      const result = await fetch(
        `${f.origin}/api/instruction-taxonomy/page?${new URLSearchParams({ path: f.entityPath(kind, code) })}`,
      );
      assert.equal(result.status, 404);
      await result.arrayBuffer();
    }
  }
  assert.deepEqual(fs.readFileSync(f.filePath), before);
  assert.deepEqual(
    fs.readFileSync(path.join(f.directory, 'instructions', 'live.json')),
    originalDocument,
  );
  assert.equal(fs.existsSync(f.registry.operationsDirectory), false);
  assert.equal(f.registry.read().revision, 1);
});

test('preview search, sorting and pagination read current saved data without public pagination URLs', async t => {
  const records = Array.from({ length: 26 }, (_, index) =>
    instruction(String(index).padStart(2, '0'), {
      title:
        index === 0 ? 'АЛЬФА: сохранённая инструкция' : `Работа ${String(index).padStart(2, '0')}`,
      publishedAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    }),
  );
  records.push(instruction('noindex', { seoStatus: 'noindex' }));
  records.push(instruction('draft', { seoStatus: 'draft', title: 'PRIVATE_DRAFT_TITLE' }));
  const f = await fixture(t, records);
  let response = await f.request('/section/W01/preview');
  let page = (await response.json()).page;
  assert.equal(page.total, 27);
  assert.equal(page.items.length, 24);
  assert.equal(page.totalPages, 2);
  assert.ok(page.pagination.every(item => item.path === null));
  assert.equal(page.previousPath, null);
  assert.equal(page.nextPath, null);
  response = await f.request('/section/W01/preview?page=2');
  page = (await response.json()).page;
  assert.equal(page.page, 2);
  assert.equal(page.items.length, 3);
  response = await f.request(`/section/W01/preview?${new URLSearchParams({ q: 'альфа' })}`);
  page = (await response.json()).page;
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, '00');
  response = await f.request('/section/W01/preview?sort=newest');
  page = (await response.json()).page;
  assert.equal(page.items[0].id, '25');
  f.instructions.save(instruction('added', { title: 'ААА новая инструкция' }));
  response = await f.request('/section/W01/preview');
  page = (await response.json()).page;
  assert.equal(page.total, 28);
  assert.equal(page.items[0].id, 'added');
  assert.equal(fs.existsSync(f.filePath), false);
});

test('published indexable entities still receive a strictly noindex admin preview', async t => {
  const f = await fixture(t, [instruction('live')]);
  f.update('catalog', 'H02', { status: 'published', indexingEnabled: true });
  f.update('section', 'W01', { status: 'published', indexingEnabled: true });
  const before = fs.readFileSync(f.filePath);
  const response = await f.request('/section/W01/preview');
  assert.equal(response.status, 200);
  privateResponse(response);
  const { page } = await response.json();
  assert.equal(page.entityStatus, 'published');
  assert.equal(page.publicPath, f.entityPath('section', 'W01'));
  assert.equal(page.seo.indexable, false);
  assert.equal(page.seo.robots, 'noindex, nofollow');
  assert.deepEqual(fs.readFileSync(f.filePath), before);
  assert.ok(
    f.publicService
      .snapshot()
      .sitemap(siteUrl)
      .some(item => item.path === page.publicPath),
  );
});

test('preview rejects unknown, nested and repeated query keys before taking a snapshot', async t => {
  const f = await fixture(t);
  for (const query of [
    'token=secret',
    'path=/draft',
    'refresh=true',
    'q=x&q=y',
    'q[term]=x',
    'sort[]=title',
    'page[]=2',
  ]) {
    const response = await f.request(`/section/W01/preview?${query}`);
    assert.equal(response.status, 400, query);
    privateResponse(response);
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_PUBLIC_QUERY');
  }
  assert.deepEqual(f.calls, []);
});

test('missing preview entities and invalid list parameters return safe errors without storage writes', async t => {
  const f = await fixture(t, [instruction('live')]);
  for (const route of [
    '/constructor/W01/preview',
    '/section/MISSING/preview',
    '/root/MISSING/preview',
    '/section/W01/preview?page=3',
  ]) {
    const response = await f.request(route);
    assert.equal(response.status, 404, route);
    privateResponse(response);
    assert.equal((await response.json()).code, 'TAXONOMY_ENTITY_NOT_FOUND');
  }
  for (const query of [
    'page=0',
    'page=-1',
    'page=1.5',
    'page=999999999999999999999',
    'sort=popular',
    `q=${'x'.repeat(201)}`,
  ]) {
    const response = await f.request(`/section/W01/preview?${query}`);
    assert.equal(response.status, 400, query);
    privateResponse(response);
    assert.equal((await response.json()).code, 'INVALID_TAXONOMY_PUBLIC_QUERY');
  }
  assert.equal(fs.existsSync(f.filePath), false);
});

test('preview storage and unexpected failures expose no internal message, path or error details', async t => {
  const f = await fixture(t);
  t.mock.method(console, 'error', () => {});
  for (const error of [
    new Error('PRIVATE /runtime/taxonomy.json TOKEN'),
    new InstructionEditorError('PRIVATE_DRAFT_METADATA', {
      status: 500,
      code: 'PRIVATE_CODE',
      details: { file: '/private' },
    }),
  ]) {
    f.previewService.snapshot = () => {
      throw error;
    };
    const response = await f.request('/section/W01/preview');
    assert.equal(response.status, 500);
    privateResponse(response);
    assert.deepEqual(await response.json(), {
      error: 'Не удалось загрузить предпросмотр страницы',
      code: 'TAXONOMY_PREVIEW_ERROR',
    });
  }
});
