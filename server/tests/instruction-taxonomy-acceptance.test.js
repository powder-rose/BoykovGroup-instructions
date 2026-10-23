import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInstructionTaxonomyAcceptanceReport,
  normalizeInstructionAcceptanceOrigin,
} from '../src/services/instructionTaxonomyAcceptance.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const ORIGIN = 'https://boykovdocs.ru';

function fixture() {
  const registry = getInstructionTaxonomyRegistrySeed();
  for (const entity of [
    registry.catalogs[1],
    registry.sections.find(item => item.code === 'W01'),
    registry.tags[0],
  ]) {
    entity.status = 'published';
    entity.indexingEnabled = true;
    entity.seoTitle = `SEO ${entity.code}`;
    entity.seoDescription = `Описание ${entity.code}`;
  }
  const instructions = [
    {
      id: 'stable-id',
      slug: 'MiXeD-Slug',
      slugAliases: ['Old-Slug'],
      title: 'Название',
      status: 'published',
      primaryCategoryId: 'W01',
      tagIds: ['T01'],
      instructionContent: { type: 'doc', content: [] },
      seoTitle: 'SEO документа',
      filePath: 'uploads/stable.pdf',
    },
  ];
  return { registry, instructions, origin: ORIGIN };
}

test('seed inventory distinguishes legacy ROOT and 133 unpublished paths without inventing HTTP success', () => {
  const report = buildInstructionTaxonomyAcceptanceReport({
    registry: getInstructionTaxonomyRegistrySeed(),
    instructions: [],
  });
  assert.equal(report.urls.length, 134);
  assert.equal(report.counts.publicTaxonomyPages, 1);
  assert.equal(report.counts.pendingTaxonomyPages, 133);
  assert.equal(report.urls.find(row => row.code === 'H01').reason, 'route-unapproved');
  assert.equal(report.urls.find(row => row.code === 'ROOT').reason, 'legacy-root');
  assert.equal(report.counts.errors, 0);
  assert.deepEqual(report.sitemapUrls, [`${ORIGIN}/`, `${ORIGIN}/instrukcii-po-ohrane-truda`]);
  assert.equal(report.baseline.checked, false);
});

test('empty/noindex/alternate canonical pages follow independent publication and indexing rules', () => {
  const data = fixture();
  data.registry.tags[0].canonicalUrl = `${ORIGIN}/instrukcii-po-ohrane-truda`;
  data.registry.tags[1].status = 'published';
  data.registry.tags[1].indexingEnabled = true;
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  for (const code of ['T01', 'T02']) {
    const row = report.urls.find(item => item.code === code);
    assert.equal(row.expectedStatus, 200);
    assert.equal(row.robots, 'noindex, follow');
    assert.equal(row.inSitemap, false);
  }
  assert.equal(report.urls.find(item => item.code === 'T02').count, 0);
  assert.equal(report.urls.find(item => item.code === 'W01').inSitemap, true);
});

test('draft parent hides its published child while its records remain in approved catalog counts', () => {
  const data = fixture();
  data.registry.catalogs[1].status = 'draft';
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  assert.equal(report.urls.find(item => item.code === 'W01').reason, 'parent-draft');
  assert.equal(report.urls.find(item => item.code === 'W01').expectedStatus, 404);
  assert.equal(report.urls.find(item => item.id === 'stable-id').expectedStatus, 200);
  assert.ok(
    !report.urls
      .find(item => item.id === 'stable-id')
      .expectedLinks.some(item => item.endsWith('/raboty-na-vysote/')),
  );
});

test('unknown codes, duplicate tags and legacy assignments are reported separately', () => {
  const data = fixture();
  data.instructions.push({
    id: 'unknown',
    title: 'Неизвестные связи',
    primaryCategoryId: 'W99',
    tagIds: ['T999', 'T999'],
  });
  data.instructions.push({
    id: 'legacy',
    title: 'Старые связи',
    primaryCategoryId: 'manufacturing',
    tagIds: ['apparatchik'],
  });
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  assert.ok(report.issues.some(item => item.code === 'unknown-section' && item.id === 'unknown'));
  assert.ok(report.issues.some(item => item.code === 'unknown-tag' && item.id === 'unknown'));
  assert.ok(report.issues.some(item => item.code === 'duplicate-tag' && item.id === 'unknown'));
  assert.equal(report.counts.legacyAssignments, 1);
  assert.ok(!report.issues.some(item => item.severity === 'error' && item.id === 'legacy'));
});

test('aliases reserve the namespace of foreign IDs and canonical slugs without changing slug case', () => {
  const data = fixture();
  data.instructions[0].slugAliases.push('foreign-id');
  data.instructions.push({
    id: 'foreign-id',
    slug: 'Foreign-Slug',
    title: 'Вторая',
    primaryCategoryId: 'W01',
    tagIds: [],
  });
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  assert.ok(report.issues.some(item => item.code === 'duplicate-live-url'));
  const row = report.urls.find(item => item.id === 'stable-id');
  assert.equal(row.path, '/instrukciya-po-ohrane-truda/MiXeD-Slug');
  assert.equal(report.redirects.find(item => item.path.endsWith('/Old-Slug')).location, row.path);
});

test('baseline ignores only assignment metadata and revision while detecting lost or altered protected data', () => {
  const data = fixture();
  const baselineInstructions = structuredClone(data.instructions);
  data.instructions[0].primaryCategoryId = 'W02';
  data.instructions[0].tagIds = [];
  data.instructions[0].taxonomyMeta = { source: 'manual' };
  data.instructions[0].revision = 8;
  const clean = buildInstructionTaxonomyAcceptanceReport({ ...data, baselineInstructions });
  assert.equal(clean.baseline.preserved, 1);
  assert.equal(clean.baseline.rows[0].beforeSha256, clean.baseline.rows[0].afterSha256);
  data.instructions[0].seoTitle = 'Изменено';
  data.instructions[0].filePath = 'uploads/replaced.pdf';
  data.instructions[0].slug = 'New-Path';
  const changed = buildInstructionTaxonomyAcceptanceReport({ ...data, baselineInstructions });
  assert.deepEqual(changed.baseline.rows[0].changedFields, ['filePath', 'seoTitle', 'slug']);
  assert.ok(changed.issues.some(item => item.code === 'baseline-protected-fields-changed'));
  const missing = buildInstructionTaxonomyAcceptanceReport({
    ...data,
    instructions: [],
    baselineInstructions,
  });
  assert.ok(missing.issues.some(item => item.code === 'baseline-instruction-missing'));
});

test('canonical targeting a known draft is an error; external canonical and missing SEO are editorial warnings', () => {
  const data = fixture();
  data.registry.tags[0].canonicalUrl = `${ORIGIN}/instrukcii-po-ohrane-truda/temy/${data.registry.tags[1].slug}/`;
  const blocked = buildInstructionTaxonomyAcceptanceReport(data);
  assert.ok(blocked.issues.some(item => item.code === 'canonical-to-unavailable-page'));
  data.registry.tags[0].canonicalUrl = 'https://example.org/topic/';
  data.registry.sections.find(item => item.code === 'W01').seoTitle = '';
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  assert.ok(
    report.issues.some(item => item.code === 'external-canonical' && item.severity === 'warning'),
  );
  assert.ok(
    report.issues.some(item => item.code === 'missing-seo-field' && item.detail === 'seoTitle'),
  );
});

test('technical pagination, sort, search and tracking variants are noindex and retain base canonical', () => {
  const data = fixture();
  data.instructions = Array.from({ length: 25 }, (_, index) => ({
    ...data.instructions[0],
    id: `i-${index}`,
    slug: `slug-${index}`,
    slugAliases: [],
    title: `Инструкция ${index}`,
  }));
  const before = JSON.stringify(data);
  const report = buildInstructionTaxonomyAcceptanceReport(data);
  const row = report.urls.find(item => item.code === 'W01');
  assert.equal(row.totalPages, 2);
  const next = report.technicalUrls.find(item => item.url === `${row.url}?page=2`);
  assert.equal(next.canonicalUrl, row.url);
  assert.equal(next.robots, 'noindex, follow');
  assert.equal(next.indexable, false);
  assert.equal(
    report.technicalUrls.find(item => item.url === `${row.url}?page=3`).expectedStatus,
    404,
  );
  assert.ok(report.technicalUrls.some(item => item.url.includes('utm_source=')));
  assert.equal(JSON.stringify(data), before);
});

test('origin validation rejects credentials, query, fragments, paths and non-HTTP schemes', () => {
  for (const value of [
    'file:///tmp',
    'https://user:pass@example.org',
    'https://example.org/x',
    'https://example.org?x',
    'https://example.org#x',
    'https://example.org\\',
  ]) {
    assert.throws(() => normalizeInstructionAcceptanceOrigin(value));
  }
  assert.equal(
    normalizeInstructionAcceptanceOrigin('http://127.0.0.1:3000'),
    'http://127.0.0.1:3000',
  );
});

test('invalid revisions, unsafe storage IDs and nontext titles cannot yield a successful model', () => {
  for (const invalid of [
    { revision: -1 },
    { revision: 1.5 },
    { id: '../escape' },
    { id: 'trailing.' },
    { title: 123 },
  ]) {
    const data = fixture();
    Object.assign(data.instructions[0], invalid);
    assert.throws(
      () => buildInstructionTaxonomyAcceptanceReport(data),
      /Malformed instruction storage/,
    );
  }
});
