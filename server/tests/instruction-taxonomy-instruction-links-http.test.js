import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';
import { getInstructionPublicPath } from '../src/shared/instructionDocument.js';

function instruction(id, overrides = {}) {
  return {
    id,
    slug: `${id}-MiXeD`,
    title: `Название инструкции ${id}`,
    profession: 'Другая краткая профессия',
    primaryCategoryId: 'W01',
    tagIds: ['T01', 'T02'],
    status: 'published',
    seoTitle: `Сохранённый SEO Title ${id}`,
    seoDescription: 'Сохранённое описание инструкции.',
    instructionContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'НЕИЗМЕННЫЙ ТЕКСТ ИНСТРУКЦИИ' }] },
      ],
    },
    editorialMeta: { seoAuthor: 'PRIVATE_EDITOR_NAME' },
    ...overrides,
  };
}

async function fixture(t, records, { fileBacked = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-instruction-links-'));
  const storageDirectory = path.join(directory, 'instructions');
  const writeRecord = item => {
    fs.mkdirSync(storageDirectory, { recursive: true });
    fs.writeFileSync(path.join(storageDirectory, `${item.id}.json`), JSON.stringify(item));
  };
  if (fileBacked) records.forEach(writeRecord);
  const registry = getInstructionTaxonomyRegistrySeed();
  const catalog = registry.catalogs.find(item => item.code === 'H02');
  const section = registry.sections.find(item => item.code === 'W01');
  const tag = registry.tags.find(item => item.code === 'T01');
  catalog.status = 'published';
  section.status = 'published';
  section.name = 'Тестовый основной раздел';
  tag.status = 'published';
  tag.name = 'Тестовая опубликованная тема';
  const memoryRepository = {
    getAll: () => records,
    getAllFresh: () => records,
    getBySlug: value =>
      records.find(
        item => item.slug === value || item.id === value || item.slugAliases?.includes(value),
      ) || null,
    getById: value => records.find(item => item.id === value) || null,
  };
  const repository = fileBacked ? new InstructionsRepository(storageDirectory) : memoryRepository;
  const taxonomyService = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: { read: () => registry },
  });
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Before</title></head><body><div id="root"></div></body></html>',
  );
  const app = express();
  app.use('/api/instructions', createInstructionPagesRouter({ repository, taxonomyService }));
  app.use(createSeoRouter({ repository, taxonomyService, indexPath }));
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
  const api = async item => {
    const response = await fetch(`${base}/api/instructions/page/${item.slug}`);
    return { response, body: await response.json() };
  };
  const html = async item => {
    const response = await fetch(`${base}${getInstructionPublicPath(item)}`);
    return { response, body: await response.text() };
  };
  return {
    registry,
    catalog,
    section,
    tag,
    base,
    api,
    html,
    taxonomyService,
    repository,
    writeRecord,
  };
}

function breadcrumbSchema(html) {
  const serialized = html.match(
    /<script type="application\/ld\+json" data-instruction-seo>([\s\S]*?)<\/script>/u,
  )?.[1];
  assert.ok(serialized);
  return JSON.parse(serialized)['@graph'].find(item => item['@type'] === 'BreadcrumbList');
}

test('instruction API and SSR share published hierarchy, ordinary links and eight related records without altering content or SEO', async t => {
  const current = instruction('current');
  const records = [
    current,
    ...Array.from({ length: 10 }, (_, i) => instruction(`candidate-${i}`)),
    instruction('draft', { status: 'draft' }),
  ];
  const originals = structuredClone(records);
  const { api, html } = await fixture(t, records);
  const { response: apiResponse, body: page } = await api(current);
  assert.equal(apiResponse.status, 200);
  assert.equal(apiResponse.headers.get('cache-control'), 'no-store');
  const navigation = page.taxonomyNavigation;
  assert.deepEqual(
    navigation.breadcrumbs.map(item => item.name),
    [
      'Главная',
      'Инструкции по охране труда',
      'По видам работ',
      'Тестовый основной раздел',
      current.title,
    ],
  );
  assert.equal(navigation.breadcrumbs.at(-1).path, null);
  assert.equal(navigation.category.path, navigation.breadcrumbs[3].path);
  assert.ok(navigation.tags[0].path?.startsWith('/instrukcii-po-ohrane-truda/temy/'));
  assert.equal(navigation.tags[1].path, null);
  assert.deepEqual(Object.keys(navigation).sort(), ['breadcrumbs', 'category', 'tags']);
  for (const term of ['seoTitle', 'source', 'routeApproved', 'PRIVATE_EDITOR_NAME']) {
    assert.equal(JSON.stringify(navigation).includes(term), false);
  }
  assert.equal(JSON.stringify(page).includes('PRIVATE_EDITOR_NAME'), false);
  assert.equal(page.slug, current.slug);
  assert.equal(page.title, current.title);
  assert.deepEqual(page.instructionContent, current.instructionContent);
  assert.equal(page.relatedInstructions.length, 8);
  const { response, body } = await html(current);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const breadcrumbs = body.match(/<nav aria-label="Хлебные крошки">([\s\S]*?)<\/nav>/u)?.[1];
  assert.ok(breadcrumbs);
  for (const crumb of navigation.breadcrumbs.slice(0, -1)) {
    assert.ok(breadcrumbs.includes(`href="${crumb.path}"`));
    assert.ok(breadcrumbs.includes(crumb.name));
  }
  assert.ok(breadcrumbs.includes(`<span aria-current="page">${current.title}</span>`));
  assert.equal(breadcrumbs.includes(current.profession), false);
  assert.ok(
    body.includes(`class="InstructionTaxonomy_category" href="${navigation.category.path}"`),
  );
  assert.ok(body.includes(`class="InstructionTaxonomy_tag" href="${navigation.tags[0].path}"`));
  assert.ok(body.includes('class="InstructionTaxonomy_tags" aria-label="Теги инструкции"'));
  assert.ok(body.includes('href="/instrukcii-po-ohrane-truda?tag=T02"'));
  assert.ok(body.includes(`<title>${current.seoTitle}</title>`));
  assert.ok(body.includes(`content="${current.seoDescription}"`));
  assert.ok(body.includes('НЕИЗМЕННЫЙ ТЕКСТ ИНСТРУКЦИИ'));
  assert.ok(body.includes(`data-instruction-pdf-download="${current.id}"`));
  const schema = breadcrumbSchema(body);
  assert.deepEqual(
    schema.itemListElement.map(item => item.name),
    navigation.breadcrumbs.map(item => item.name),
  );
  assert.deepEqual(
    schema.itemListElement.map(item => item.position),
    [1, 2, 3, 4, 5],
  );
  const siteUrl = String(process.env.SITE_URL || response.url)
    .replace(/\/instrukciya-po-ohrane-truda\/.+$/u, '')
    .replace(/\/+$/u, '');
  assert.equal(
    schema.itemListElement.at(-1).item,
    `${siteUrl}${getInstructionPublicPath(current)}`,
  );
  const relatedHtml = body.match(/<aside class="instruction-related"[\s\S]*?<\/aside>/u)?.[0];
  assert.ok(relatedHtml);
  const relatedPaths = [...relatedHtml.matchAll(/<li><a href="([^"]+)">/gu)].map(match => match[1]);
  assert.deepEqual(relatedPaths, page.relatedInstructions.map(getInstructionPublicPath));
  assert.equal(new Set(relatedPaths).size, 8);
  assert.deepEqual(records, originals);
});

test('published rename and unpublication update instruction links without exposing draft or unapproved landing paths', async t => {
  const current = instruction('current');
  const { api, html, section, tag, catalog } = await fixture(t, [current]);
  const first = (await api(current)).body.taxonomyNavigation;
  section.slug = 'novoe-imya-razdela';
  const renamed = (await api(current)).body.taxonomyNavigation;
  assert.notEqual(renamed.category.path, first.category.path);
  assert.ok(renamed.category.path.endsWith('/novoe-imya-razdela/'));
  assert.ok((await html(current)).body.includes(`href="${renamed.category.path}"`));
  section.status = 'draft';
  tag.status = 'draft';
  let page = (await api(current)).body;
  assert.equal(page.taxonomyNavigation.category.path, null);
  assert.ok(page.taxonomyNavigation.tags.every(item => item.path === null));
  assert.equal(page.taxonomyNavigation.breadcrumbs.length, 4);
  catalog.status = 'draft';
  page = (await api(current)).body;
  assert.equal(page.taxonomyNavigation.breadcrumbs.length, 3);
  let body = (await html(current)).body;
  assert.equal(body.includes(`href="${renamed.category.path}"`), false);
  assert.ok(body.includes('href="/instrukcii-po-ohrane-truda?category=W01"'));
  current.primaryCategoryId = 'P01';
  page = (await api(current)).body;
  assert.equal(page.taxonomyNavigation.category.path, null);
  assert.equal(page.taxonomyNavigation.breadcrumbs.length, 3);
  body = (await html(current)).body;
  assert.equal(body.includes('/instrukcii-po-ohrane-truda/po-professiyam/'), false);
  assert.equal(body.includes('/instrukcii-po-ohrane-truda/po-professiyam-i-dolzhnostyam/'), false);
});

test('instruction APIs and SSR exclude saved drafts while published noindex documents retain links', async t => {
  const draft = instruction('draft', { status: 'draft' });
  const seoDraft = instruction('seo-draft', { seoStatus: 'draft' });
  const noindex = instruction('noindex', { seoStatus: 'noindex' });
  const { base, api, html } = await fixture(t, [draft, seoDraft, noindex]);
  for (const item of [draft, seoDraft]) {
    assert.equal((await api(item)).response.status, 404);
    assert.equal((await html(item)).response.status, 404);
    assert.equal((await fetch(`${base}/api/instructions/${item.id}/related`)).status, 404);
  }
  assert.equal((await api(noindex)).response.status, 200);
  const { response, body } = await html(noindex);
  assert.equal(response.status, 200);
  assert.match(body, /name="robots"\s+content="noindex, follow"/u);
  assert.ok(
    body.includes(
      'class="InstructionTaxonomy_category" href="/instrukcii-po-ohrane-truda/po-vidam-rabot/',
    ),
  );
});

test('legacy assignments keep query-filter links and full-title breadcrumbs safely escaped in HTML and JSON-LD', async t => {
  const current = instruction('legacy', {
    title: 'Название <особое> & "важное"',
    primaryCategoryId: 'electrical',
    tagIds: ['elektrik'],
  });
  const { api, html } = await fixture(t, [current]);
  const navigation = (await api(current)).body.taxonomyNavigation;
  assert.equal(navigation.breadcrumbs.length, 3);
  assert.equal(navigation.category.path, null);
  assert.equal(navigation.tags[0].path, null);
  const { body } = await html(current);
  assert.ok(body.includes('href="/instrukcii-po-ohrane-truda?category=electrical"'));
  assert.ok(body.includes('href="/instrukcii-po-ohrane-truda?tag=elektrik"'));
  assert.ok(
    body.includes('aria-current="page">Название &lt;особое&gt; &amp; &quot;важное&quot;</span>'),
  );
  assert.equal(body.includes('<особое>'), false);
  assert.equal(breadcrumbSchema(body).itemListElement.at(-1).name, current.title);
});

test('first instruction response observes offline file changes and unpublication after warming the repository cache', async t => {
  const current = instruction('offline');
  const { api, html, base, repository, writeRecord } = await fixture(t, [current], {
    fileBacked: true,
  });
  const readFresh = t.mock.method(repository, 'getAllFresh');
  const first = await api(current);
  assert.equal(first.response.status, 200);
  assert.equal(readFresh.mock.callCount(), 1);
  assert.equal(repository.getById(current.id).primaryCategoryId, 'W01');
  writeRecord({ ...current, primaryCategoryId: 'W02', tagIds: ['T02'] });
  let readsBefore = readFresh.mock.callCount();
  const changed = await api(current);
  assert.equal(changed.response.status, 200);
  assert.equal(readFresh.mock.callCount() - readsBefore, 1);
  assert.equal(changed.body.primaryCategoryId, 'W02');
  assert.equal(changed.body.taxonomyNavigation.category.id, 'W02');
  assert.deepEqual(
    changed.body.taxonomyNavigation.tags.map(item => item.id),
    ['T02'],
  );

  writeRecord(current);
  readsBefore = readFresh.mock.callCount();
  const refreshedHtml = await html(current);
  assert.equal(refreshedHtml.response.status, 200);
  assert.equal(readFresh.mock.callCount() - readsBefore, 1);
  assert.ok(refreshedHtml.body.includes('href="/instrukcii-po-ohrane-truda/po-vidam-rabot/'));

  readsBefore = readFresh.mock.callCount();
  const related = await fetch(`${base}/api/instructions/${current.id}/related`);
  assert.equal(related.status, 200);
  assert.equal(readFresh.mock.callCount() - readsBefore, 1);

  for (const request of [
    () => api(current).then(result => result.response),
    () => fetch(`${base}/api/instructions/${current.id}/related`),
    () => html(current).then(result => result.response),
  ]) {
    writeRecord(current);
    repository.getAllFresh();
    assert.equal(repository.getById(current.id).status, 'published');
    writeRecord({ ...current, status: 'draft' });
    readsBefore = readFresh.mock.callCount();
    assert.equal((await request()).status, 404);
    assert.equal(readFresh.mock.callCount() - readsBefore, 1);
  }
});
