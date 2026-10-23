import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { createInstructionTaxonomyRouter } from '../src/routes/instructionTaxonomy.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyEntityPath } from '../src/services/instructionTaxonomyRegistryModel.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';
import { getInstructionPublicPath } from '../src/shared/instructionDocument.js';

const taxonomyOrigin = 'https://indexed.fixture.boykovdocs.ru';
const bodyMarker = 'СОХРАНЁННЫЙ ПОЛНЫЙ ТЕКСТ '.repeat(300);

function instruction(id, overrides = {}) {
  return {
    id,
    slug: `${id}-MiXeD`,
    slugAliases: [`${id}-old-Alias`],
    title: `Инструкция ${id}`,
    profession: 'Электрик',
    primaryCategoryId: 'W01',
    tagIds: ['T01'],
    status: 'published',
    revision: 3,
    createdAt: '2026-09-01T12:00:00.000Z',
    modifiedAt: '2026-09-08T12:00:00.000Z',
    seoTitle: `Сохранённый SEO Title ${id}`,
    seoDescription: `Сохранённое описание ${id}`,
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: bodyMarker }] }],
    },
    explanationContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пояснение документа' }] }],
    },
    editorialMeta: { seoAuthor: 'PRIVATE_INDEX_EDITOR' },
    files: [{ name: 'instruction.pdf', path: `/files/${id}.pdf` }],
    ...overrides,
  };
}

function countInstructionReads(t, directory) {
  const descriptors = new Map();
  const reads = [];
  const open = fs.openSync;
  const close = fs.closeSync;
  const read = fs.readFileSync;
  const filename = value => {
    if (typeof value === 'number') return descriptors.get(value);
    if (value instanceof URL) return fileURLToPath(value);
    return typeof value === 'string' ? path.resolve(value) : undefined;
  };
  t.mock.method(fs, 'openSync', (...args) => {
    const descriptor = open(...args);
    const file = filename(args[0]);
    if (file) descriptors.set(descriptor, file);
    return descriptor;
  });
  t.mock.method(fs, 'closeSync', descriptor => {
    descriptors.delete(descriptor);
    return close(descriptor);
  });
  t.mock.method(fs, 'readFileSync', (...args) => {
    const file = filename(args[0]);
    if (file && path.dirname(file) === directory && file.endsWith('.json')) {
      reads.push(path.basename(file));
    }
    return read(...args);
  });
  return {
    reads,
    async expect(count, request) {
      const before = reads.length;
      const result = await request();
      assert.equal(reads.length - before, count, `JSON reads during ${request.name || 'request'}`);
      return result;
    },
  };
}

async function fixture(t, records) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-index-flow-'));
  const instructionsDirectory = path.join(directory, 'instructions');
  fs.mkdirSync(instructionsDirectory);
  const file = id => path.join(instructionsDirectory, `${id}.json`);
  const write = record => fs.writeFileSync(file(record.id), JSON.stringify(record));
  records.forEach(write);
  const repository = new InstructionsRepository(instructionsDirectory);
  const registry = getInstructionTaxonomyRegistrySeed();
  for (const [collection, code] of [
    ['catalogs', 'H02'],
    ['sections', 'W01'],
    ['tags', 'T01'],
  ]) {
    const entity = registry[collection].find(item => item.code === code);
    entity.status = 'published';
    entity.indexingEnabled = true;
  }
  const taxonomyService = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: { read: () => registry },
  });
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Original head</title></head><body><div id="root"></div></body></html>',
  );
  const app = express();
  app.use((req, _res, next) => {
    if (req.get('x-test-role') === 'admin') req.user = { role: 'admin', sub: 'index-admin' };
    next();
  });
  app.use(
    '/api/instruction-taxonomy',
    createInstructionTaxonomyRouter({ service: taxonomyService, origin: taxonomyOrigin }),
  );
  app.use('/api/instructions', createInstructionPagesRouter({ repository, taxonomyService }));
  app.use(
    '/api/admin/instruction-taxonomy',
    createAdminInstructionTaxonomyRouter({
      service: { read: () => registry },
      previewService: taxonomyService,
      origin: taxonomyOrigin,
    }),
  );
  app.use(createSeoRouter({ repository, taxonomyService, taxonomyOrigin, indexPath }));
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ code: error.code || 'INTERNAL_ERROR' }),
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) => fetch(base + route, { redirect: 'manual', ...options });
  const json = async (route, options) => {
    const response = await request(route, options);
    return { response, data: await response.json() };
  };
  const html = async route => {
    const response = await request(route);
    return { response, text: await response.text() };
  };
  const entityPath = (kind, code) => getInstructionTaxonomyEntityPath(registry, kind, code);
  const navigation = () => json('/api/instruction-taxonomy/navigation');
  const page = (kind = 'section', code = 'W01', suffix = '') =>
    json(
      `/api/instruction-taxonomy/page?path=${encodeURIComponent(entityPath(kind, code))}${suffix}`,
    );
  const preview = (kind = 'section', code = 'W01') =>
    json(`/api/admin/instruction-taxonomy/${kind}/${code}/preview`, {
      headers: { 'x-test-role': 'admin' },
    });
  const reads = countInstructionReads(t, instructionsDirectory);
  return {
    repository,
    registry,
    taxonomyService,
    navigation,
    page,
    preview,
    entityPath,
    request,
    json,
    html,
    file,
    write,
    reads,
  };
}

function sectionCount(navigation) {
  return navigation.catalogs
    .find(item => item.code === 'H02')
    .sections.find(item => item.code === 'W01').count;
}

function instructionSitemapEntry(xml, record) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gu)]
    .map(match => match[1])
    .find(entry => entry.includes(`${getInstructionPublicPath(record)}</loc>`));
}

test('cold index reads each JSON once and warm public HTML, APIs, preview and sitemap reuse thin references', async t => {
  const records = Array.from({ length: 27 }, (_, index) =>
    instruction(`item-${String(index).padStart(2, '0')}`, {
      ...(index === 0 ? { seoStatus: 'noindex' } : {}),
      ...(index === 2 ? { updatedAt: '2026-10-12T12:00:00.000Z' } : {}),
    }),
  );
  records.push(instruction('draft-only', { status: 'draft' }));
  records.push(instruction('seo-draft', { seoStatus: 'draft' }));
  const f = await fixture(t, records);
  const navigation = await f.reads.expect(records.length, () => f.navigation());
  assert.equal(navigation.response.status, 200);
  assert.equal(sectionCount(navigation.data), 27);
  assert.equal(new Set(f.reads.reads).size, records.length);

  const page = await f.reads.expect(0, () => f.page());
  assert.equal(page.response.status, 200);
  assert.equal(page.data.total, 27);
  assert.equal(page.data.items.length, 24);
  assert.equal(page.data.totalPages, 2);
  assert.ok(page.data.items.some(item => item.id === 'item-00'));
  assert.equal(JSON.stringify(page.data).includes(bodyMarker), false);
  assert.equal(JSON.stringify(page.data).includes('PRIVATE_INDEX_EDITOR'), false);
  const section = await f.reads.expect(0, () => f.html(f.entityPath('section', 'W01')));
  assert.equal(section.response.status, 200);
  for (const record of page.data.items)
    assert.ok(section.text.includes(`href="${getInstructionPublicPath(record)}"`));
  const second = await f.reads.expect(0, () => f.page('section', 'W01', '&page=2'));
  assert.equal(second.data.items.length, 3);
  const preview = await f.reads.expect(0, () => f.preview());
  assert.equal(preview.response.status, 200);
  assert.equal(preview.data.page.total, 27);
  assert.equal(preview.data.page.items.length, 24);
  assert.equal(preview.data.page.seo.robots, 'noindex, nofollow');

  const current = records[1];
  const individual = await f.reads.expect(0, () =>
    f.json(`/api/instructions/page/${current.slug}`),
  );
  assert.equal(individual.response.status, 200);
  assert.deepEqual(individual.data.instructionContent, current.instructionContent);
  assert.equal(individual.data.relatedInstructions.length, 8);
  assert.equal(JSON.stringify(individual.data.relatedInstructions).includes(bodyMarker), false);
  const individualHtml = await f.reads.expect(0, () => f.html(getInstructionPublicPath(current)));
  assert.equal(individualHtml.response.status, 200);
  assert.ok(individualHtml.text.includes(bodyMarker));
  const related = await f.reads.expect(0, () => f.json(`/api/instructions/${current.id}/related`));
  assert.deepEqual(
    related.data.items.map(item => item.id),
    individual.data.relatedInstructions.map(item => item.id),
  );
  const root = await f.reads.expect(0, () => f.html('/instrukcii-po-ohrane-truda'));
  assert.equal(root.response.status, 200);
  assert.equal(root.text.includes(getInstructionPublicPath(records[0])), false);
  const sitemap = await f.reads.expect(0, () => f.html('/sitemap.xml'));
  assert.equal(sitemap.response.status, 200);
  assert.equal(instructionSitemapEntry(sitemap.text, records[0]), undefined);
  assert.match(
    instructionSitemapEntry(sitemap.text, records[1]),
    /<lastmod>2026-09-08<\/lastmod>/u,
  );
  assert.match(
    instructionSitemapEntry(sitemap.text, records[2]),
    /<lastmod>2026-10-12<\/lastmod>/u,
  );

  const references = f.taxonomyService.snapshot().references();
  assert.equal(references.length, 27);
  assert.equal(references.find(item => item.id === current.id).profession, current.profession);
  for (const field of ['instructionContent', 'explanationContent', 'editorialMeta', 'files']) {
    assert.ok(references.every(item => !Object.hasOwn(item, field)));
  }
  assert.equal(f.reads.reads.length, records.length);
});

test('offline edits, aliases, additions and deletions update the first response while rereading only changed files', async t => {
  const current = instruction('current');
  const peer = instruction('peer');
  const f = await fixture(t, [current, peer]);
  await f.reads.expect(2, () => f.navigation());
  const updated = {
    ...current,
    title: 'Новое сохранённое название',
    slug: 'current-NewMiXeD',
    slugAliases: [current.slug, ...current.slugAliases],
    primaryCategoryId: 'W02',
    tagIds: [],
    updatedAt: '2026-10-20T12:00:00.000Z',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'НОВЫЙ ПОЛНЫЙ ТЕКСТ' }] }],
    },
  };
  f.write(updated);
  const first = await f.reads.expect(1, () => f.json(`/api/instructions/page/${updated.slug}`));
  assert.equal(first.response.status, 200);
  assert.equal(first.data.title, updated.title);
  assert.deepEqual(first.data.instructionContent, updated.instructionContent);
  assert.equal(first.data.taxonomyNavigation.category.id, 'W02');
  assert.equal(first.data.taxonomyNavigation.category.path, null);
  const alias = await f.reads.expect(0, () => f.request(getInstructionPublicPath(current)));
  assert.equal(alias.status, 301);
  assert.equal(new URL(alias.headers.get('location')).pathname, getInstructionPublicPath(updated));
  const body = await f.reads.expect(0, () => f.html(getInstructionPublicPath(updated)));
  assert.equal(body.response.status, 200);
  assert.ok(body.text.includes('НОВЫЙ ПОЛНЫЙ ТЕКСТ'));
  assert.equal(body.text.includes(bodyMarker), false);
  const moved = await f.reads.expect(0, () => f.preview('section', 'W02'));
  assert.deepEqual(
    moved.data.page.items.map(item => item.id),
    [current.id],
  );

  const added = instruction('added');
  f.write(added);
  const navigation = await f.reads.expect(1, () => f.navigation());
  assert.equal(sectionCount(navigation.data), 2);
  assert.equal(navigation.data.catalogs.find(item => item.code === 'H02').count, 3);
  fs.unlinkSync(f.file(peer.id));
  const remaining = await f.reads.expect(0, () => f.page());
  assert.equal(remaining.data.total, 1);
  assert.equal(remaining.data.items[0].id, added.id);
  assert.equal(f.repository.getById(peer.id), null);
  const missing = await f.reads.expect(0, () => f.json(`/api/instructions/page/${peer.slug}`));
  assert.equal(missing.response.status, 404);
});

test('offline unpublication is observed before the first instruction lookup and noindex candidates stay public', async t => {
  const current = instruction('current');
  const peer = instruction('peer');
  const noindex = instruction('noindex', { seoStatus: 'noindex' });
  const f = await fixture(t, [current, peer, noindex]);
  await f.reads.expect(3, () => f.navigation());
  f.write({ ...peer, status: 'draft' });
  const unpublished = await f.reads.expect(1, () => f.json(`/api/instructions/page/${peer.slug}`));
  assert.equal(unpublished.response.status, 404);
  const related = await f.reads.expect(0, () => f.json(`/api/instructions/${current.id}/related`));
  assert.deepEqual(
    related.data.items.map(item => item.id),
    [noindex.id],
  );
  const navigation = await f.reads.expect(0, () => f.navigation());
  assert.equal(sectionCount(navigation.data), 2);
  const sitemap = await f.reads.expect(0, () => f.html('/sitemap.xml'));
  assert.equal(instructionSitemapEntry(sitemap.text, peer), undefined);
  assert.equal(instructionSitemapEntry(sitemap.text, noindex), undefined);
  assert.ok(instructionSitemapEntry(sitemap.text, current));

  f.write({ ...current, seoStatus: 'draft' });
  const hidden = await f.reads.expect(1, () => f.html(getInstructionPublicPath(current)));
  assert.equal(hidden.response.status, 404);
  assert.equal(hidden.text.includes(bodyMarker), false);
  const currentRelated = await f.reads.expect(0, () =>
    f.json(`/api/instructions/${current.id}/related`),
  );
  assert.equal(currentRelated.response.status, 404);
  const restored = { ...peer, seoStatus: 'noindex', title: 'Вновь опубликованный документ' };
  f.write(restored);
  const first = await f.reads.expect(1, () => f.json(`/api/instructions/page/${restored.slug}`));
  assert.equal(first.response.status, 200);
  assert.equal(first.data.title, restored.title);
  const html = await f.reads.expect(0, () => f.html(getInstructionPublicPath(restored)));
  assert.match(html.text, /name="robots"\s+content="noindex, follow"/u);
});

test('registry publication and renamed landing links remain current without rereading unchanged instruction JSON', async t => {
  const current = instruction('current');
  const f = await fixture(t, [current]);
  await f.reads.expect(1, () => f.navigation());
  const section = f.registry.sections.find(item => item.code === 'W01');
  const previous = f.entityPath('section', 'W01');
  section.slug = 'updated-indexed-section';
  f.registry.redirects.push({ fromPath: previous, kind: 'section', code: 'W01' });
  f.registry.revision += 1;
  const canonical = f.entityPath('section', 'W01');
  const page = await f.reads.expect(0, () => f.json(`/api/instructions/page/${current.slug}`));
  assert.equal(page.data.taxonomyNavigation.category.path, canonical);
  const redirect = await f.reads.expect(0, () => f.request(previous));
  assert.equal(redirect.status, 301);
  assert.equal(new URL(redirect.headers.get('location'), taxonomyOrigin).pathname, canonical);
  const landing = await f.reads.expect(0, () => f.html(canonical));
  assert.equal(landing.response.status, 200);
  const sitemap = await f.reads.expect(0, () => f.html('/sitemap.xml'));
  assert.ok(sitemap.text.includes(`<loc>${taxonomyOrigin}${canonical}</loc>`));
  assert.equal(sitemap.text.includes(`<loc>${taxonomyOrigin}${previous}</loc>`), false);

  section.status = 'draft';
  const hidden = await f.reads.expect(0, () => f.json(`/api/instructions/page/${current.slug}`));
  assert.equal(hidden.data.taxonomyNavigation.category.path, null);
  assert.equal(hidden.data.taxonomyNavigation.breadcrumbs.length, 4);
  const missing = await f.reads.expect(0, () => f.request(canonical));
  assert.equal(missing.status, 404);
  const preview = await f.reads.expect(0, () => f.preview());
  assert.equal(preview.response.status, 200);
  assert.equal(preview.data.page.entityStatus, 'draft');
  assert.equal(preview.data.page.publicPath, null);
  assert.equal(preview.data.page.total, 1);
});

test('a malformed changed file blocks public responses and cannot partially refresh full records before repair', async t => {
  const current = instruction('current');
  const peer = instruction('peer');
  const f = await fixture(t, [current, peer]);
  await f.reads.expect(2, () => f.navigation());
  const before = structuredClone(f.repository.getAll());
  f.write({ ...current, title: 'Сохранённая внешняя правка' });
  fs.writeFileSync(f.file(peer.id), '{invalid-json');
  t.mock.method(console, 'error', () => {});
  const broken = await f.navigation();
  assert.equal(broken.response.status, 500);
  assert.equal(broken.data.code, 'TAXONOMY_PUBLIC_ERROR');
  assert.deepEqual(f.repository.getAll(), before);
  f.write(peer);
  const repaired = await f.reads.expect(2, () => f.navigation());
  assert.equal(repaired.response.status, 200);
  assert.equal(sectionCount(repaired.data), 2);
  assert.equal(f.repository.getById(current.id).title, 'Сохранённая внешняя правка');
  const stable = await f.reads.expect(0, () => f.page());
  assert.equal(stable.data.total, 2);
});
