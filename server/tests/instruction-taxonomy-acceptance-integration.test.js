import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createSeoRouter } from '../src/routes/seo.js';
import { buildInstructionTaxonomyAcceptanceReport } from '../src/services/instructionTaxonomyAcceptance.js';
import { auditInstructionTaxonomyHttp } from '../src/services/instructionTaxonomyHttpAudit.js';
import { createInstructionTaxonomyPublicService } from '../src/services/instructionTaxonomyPublicService.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const ORIGIN = 'https://boykovdocs.ru';
const ROOT_PATH = '/instrukcii-po-ohrane-truda';

function data() {
  const registry = getInstructionTaxonomyRegistrySeed();
  for (const code of ['H02', 'W01', 'T01']) {
    const entity = [...registry.catalogs, ...registry.sections, ...registry.tags].find(
      item => item.code === code,
    );
    entity.status = 'published';
    entity.indexingEnabled = true;
    entity.seoTitle = `Название SEO ${code}`;
    entity.seoDescription = `Описание страницы ${code}`;
  }
  registry.redirects.push({
    fromPath: '/instrukcii-po-ohrane-truda/temy/old-topic/',
    kind: 'tag',
    code: 'T01',
  });
  registry.redirects.push({
    fromPath: '/instrukcii-po-ohrane-truda/old-draft-section/',
    kind: 'section',
    code: 'P01',
  });
  const instructions = Array.from({ length: 25 }, (_, index) => ({
    id: `acceptance-${index}`,
    slug: `Current-MiXeD-${index}`,
    title: `Инструкция ${String(index).padStart(2, '0')} & проверка`,
    revision: 1,
    status: 'published',
    primaryCategoryId: 'W01',
    tagIds: ['T01', 'T02'],
    seoTitle: `Название инструкции SEO ${index}`,
    seoDescription: `Описание инструкции ${index}`,
    createdAt: '2026-10-01T12:00:00.000Z',
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст документа.' }] }],
    },
  }));
  instructions[0].slugAliases = ['Earlier-MiXeD'];
  instructions.push({
    ...structuredClone(instructions[0]),
    id: 'noindex-instruction',
    slug: 'noindex-instruction',
    slugAliases: [],
    title: 'Отдельная инструкция noindex',
    seoStatus: 'noindex',
  });
  instructions.push({
    ...structuredClone(instructions[0]),
    id: 'draft-instruction',
    slug: 'draft-instruction',
    slugAliases: ['older-draft-instruction'],
    title: 'Черновик инструкции',
    status: 'draft',
  });
  const repository = {
    getAll: () => instructions,
    getAllFresh: () => instructions,
    getBySlug: value =>
      instructions.find(
        item => item.id === value || item.slug === value || item.slugAliases?.includes(value),
      ) || null,
  };
  const taxonomyService = createInstructionTaxonomyPublicService({
    repository,
    taxonomyRepository: { read: () => registry },
  });
  return { registry, instructions, repository, taxonomyService };
}

test('acceptance inventory agrees with public projection for drafts, publication, sitemap and redirects', () => {
  const fixture = data();
  const original = JSON.stringify({ registry: fixture.registry, records: fixture.instructions });
  const report = buildInstructionTaxonomyAcceptanceReport({ ...fixture, origin: ORIGIN });
  const snapshot = fixture.taxonomyService.snapshot();
  const expectedSitemap = new Set(snapshot.sitemap(ORIGIN).map(item => item.loc));
  for (const row of report.urls.filter(item => item.kind !== 'instruction')) {
    assert.equal(row.inSitemap, expectedSitemap.has(row.url), row.path);
    if (row.kind === 'root') {
      assert.equal(row.expectedStatus, 200);
      assert.equal(row.reason, 'legacy-root');
      continue;
    }
    const resolved = snapshot.resolve(row.path, {}, ORIGIN);
    assert.equal(row.expectedStatus, resolved.status, row.path);
    if (resolved.status === 200) {
      assert.equal(row.canonicalUrl, resolved.page.seo.canonicalUrl);
      assert.equal(row.robots, resolved.page.seo.robots);
      assert.equal(row.count, resolved.page.total);
      assert.equal(row.totalPages, resolved.page.totalPages);
    }
  }
  for (const row of report.redirects.filter(item => !item.path.startsWith('/instrukciya-'))) {
    if (row.path === `${ROOT_PATH}/`) continue;
    const resolved = snapshot.resolve(row.path, {}, ORIGIN);
    assert.equal(row.expectedStatus, resolved.status, row.path);
    if (resolved.status === 301) assert.equal(row.location, resolved.location, row.path);
  }
  assert.equal(report.urls.find(item => item.code === 'P01').reason, 'route-unapproved');
  assert.equal(report.urls.find(item => item.id === 'noindex-instruction').inSitemap, false);
  assert.equal(report.urls.find(item => item.id === 'draft-instruction').expectedStatus, 404);
  assert.equal(report.counts.errors, 0);
  assert.equal(
    JSON.stringify({ registry: fixture.registry, records: fixture.instructions }),
    original,
  );
});

test('HTTP audit validates actual server HTML with 24-card pages, noindex members, aliases and saved redirects', async t => {
  const fixture = data();
  const savedOrigin = process.env.SITE_URL;
  process.env.SITE_URL = ORIGIN;
  t.after(() => {
    if (savedOrigin === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = savedOrigin;
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-acceptance-integration-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Old title</title><meta name="robots" content="old"><link rel="canonical" href="https://old.invalid/"></head><body><div id="root"></div></body></html>',
  );
  const app = express();
  app.use(
    createSeoRouter({
      repository: fixture.repository,
      taxonomyService: fixture.taxonomyService,
      taxonomyOrigin: ORIGIN,
      indexPath,
      relatedInstructions: () => [],
    }),
  );
  app.use((error, _request, response, _next) =>
    response.status(error.status || 500).json({ error: error.message }),
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
  const report = buildInstructionTaxonomyAcceptanceReport({ ...fixture, origin: ORIGIN });
  const actual = await auditInstructionTaxonomyHttp({
    report,
    requestOrigin: `http://127.0.0.1:${server.address().port}`,
  });
  assert.deepEqual(
    actual.issues.filter(item => item.severity === 'error'),
    [],
  );
});
