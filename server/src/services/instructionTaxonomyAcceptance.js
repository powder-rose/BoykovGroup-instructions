import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { getInstructionPublicPath, getInstructionSeo } from '../shared/instructionDocument.js';
import { buildReclassificationLiveIndex } from './instructionReclassificationPreflight.js';
import {
  getInstructionTaxonomyEntityPath,
  listInstructionTaxonomyEntities,
  validateInstructionTaxonomyRegistry,
} from './instructionTaxonomyRegistryModel.js';
import { getLegacyInstructionTaxonomyCatalog } from './instructionTaxonomySource.js';

const ROOT_PATH = '/instrukcii-po-ohrane-truda';
const PAGE_SIZE = 24;
const MANAGED_FIELDS = new Set(['primaryCategoryId', 'tagIds', 'taxonomyMeta', 'revision']);

export function normalizeInstructionAcceptanceOrigin(value) {
  const url = new URL(value);
  if (
    typeof value !== 'string' ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    /[\s\\?#]/u.test(value)
  )
    throw new Error('Audit origin must be an HTTP(S) origin without credentials, path or query');
  return url.origin;
}

function visible(record) {
  return ![record.status, record.seoStatus].some(value => String(value).toLowerCase() === 'draft');
}

function titled(record) {
  return typeof record.title === 'string' && Boolean(record.title.trim());
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stable(value[key])]),
    );
  return value;
}

function preservedRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !MANAGED_FIELDS.has(key)));
}

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function assertAuditRecord(record) {
  if (!record || typeof record.id !== 'string' || !record.id.trim())
    throw new TypeError('Each instruction needs a nonempty ID');
  if (
    record.id !== record.id.trim() ||
    record.id === '.' ||
    record.id === '..' ||
    /[\\/<>:"|?*]/u.test(record.id) ||
    [...record.id].some(
      character => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f,
    ) ||
    record.id.endsWith('.') ||
    (record.revision !== undefined &&
      (!Number.isSafeInteger(record.revision) || record.revision < 0)) ||
    (record.title !== undefined && record.title !== null && typeof record.title !== 'string')
  )
    throw new TypeError(`Malformed instruction storage fields: ${record.id}`);
  if (
    (record.tagIds !== undefined &&
      record.tagIds !== null &&
      (!Array.isArray(record.tagIds) || record.tagIds.some(id => typeof id !== 'string'))) ||
    (record.primaryCategoryId !== undefined &&
      record.primaryCategoryId !== null &&
      typeof record.primaryCategoryId !== 'string') ||
    (record.slug !== undefined && record.slug !== null && typeof record.slug !== 'string') ||
    (record.slugAliases !== undefined &&
      record.slugAliases !== null &&
      (!Array.isArray(record.slugAliases) ||
        record.slugAliases.some(alias => typeof alias !== 'string' || !alias)))
  )
    throw new TypeError(`Malformed instruction URL or assignment fields: ${record.id}`);
}

function preservation(baseline, instructions, issues) {
  if (baseline === null) return { checked: false, reason: 'No before snapshot supplied' };
  if (!Array.isArray(baseline)) throw new TypeError('Baseline instructions must be an array');
  const current = new Map(instructions.map(record => [record.id, record]));
  const seen = new Set();
  const rows = baseline.map(before => {
    assertAuditRecord(before);
    if (!before || typeof before.id !== 'string' || seen.has(before.id))
      throw new Error('Baseline IDs must be present and unique');
    seen.add(before.id);
    const after = current.get(before.id);
    const changedFields = after
      ? [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter(key => !MANAGED_FIELDS.has(key) && !isDeepStrictEqual(before[key], after[key]))
          .sort()
      : [];
    const status = !after ? 'missing' : changedFields.length ? 'changed' : 'preserved';
    if (status !== 'preserved')
      issues.push({
        severity: 'error',
        code:
          status === 'missing'
            ? 'baseline-instruction-missing'
            : 'baseline-protected-fields-changed',
        id: before.id,
        detail:
          status === 'missing'
            ? 'Instruction absent from current snapshot'
            : changedFields.join(', '),
      });
    return {
      id: before.id,
      status,
      beforePath: getInstructionPublicPath(before),
      afterPath: after ? getInstructionPublicPath(after) : null,
      beforeSha256: digest(preservedRecord(before)),
      afterSha256: after ? digest(preservedRecord(after)) : null,
      changedFields,
    };
  });
  return {
    checked: true,
    ignoredFields: [...MANAGED_FIELDS],
    filesOutsideJsonChecked: false,
    before: baseline.length,
    after: instructions.length,
    addedIds: instructions.filter(record => !seen.has(record.id)).map(record => record.id),
    preserved: rows.filter(row => row.status === 'preserved').length,
    rows,
  };
}

function instructionChecks(instructions, registry, origin, issues) {
  if (!Array.isArray(instructions)) throw new TypeError('Instructions must be an array');
  instructions.forEach(assertAuditRecord);
  const namespaceErrors = [];
  buildReclassificationLiveIndex(instructions, origin, namespaceErrors);
  for (const error of namespaceErrors)
    issues.push({ severity: 'error', code: error.code, url: error.url, detail: error.message });
  const legacy = getLegacyInstructionTaxonomyCatalog();
  const sections = new Set(registry.sections.map(item => item.code));
  const tags = new Set(registry.tags.map(item => item.code));
  const oldSections = new Set(legacy.categories.map(item => item.id));
  const oldTags = new Set(legacy.tags.map(item => item.id));
  let legacyAssignments = 0;
  let unassigned = 0;
  for (const record of instructions) {
    const category = record.primaryCategoryId;
    if (!category) unassigned += 1;
    else if (!sections.has(category) && !oldSections.has(category))
      issues.push({ severity: 'error', code: 'unknown-section', id: record.id, detail: category });
    if (oldSections.has(category) || record.tagIds?.some(id => oldTags.has(id)))
      legacyAssignments += 1;
    for (const tag of record.tagIds || []) {
      if (!tags.has(tag) && !oldTags.has(tag))
        issues.push({ severity: 'error', code: 'unknown-tag', id: record.id, detail: tag });
    }
    if (new Set(record.tagIds || []).size !== (record.tagIds || []).length)
      issues.push({
        severity: 'error',
        code: 'duplicate-tag',
        id: record.id,
        detail: 'Repeated tag IDs',
      });
    if (!titled(record))
      issues.push({
        severity: 'warning',
        code: 'instruction-without-title',
        id: record.id,
        detail: 'Excluded from lists and sitemap',
      });
  }
  if (legacyAssignments)
    issues.push({
      severity: 'warning',
      code: 'legacy-assignments-remain',
      detail: String(legacyAssignments),
    });
  if (unassigned)
    issues.push({
      severity: 'warning',
      code: 'unassigned-instructions',
      detail: String(unassigned),
    });
  return { legacyAssignments, unassigned };
}

export function buildInstructionTaxonomyAcceptanceReport({
  registry,
  instructions,
  origin = 'https://boykovdocs.ru',
  baselineInstructions = null,
}) {
  validateInstructionTaxonomyRegistry(registry);
  const base = normalizeInstructionAcceptanceOrigin(origin);
  const issues = [];
  const assignments = instructionChecks(instructions, registry, base, issues);
  const entities = listInstructionTaxonomyEntities(registry);
  const catalogs = new Map(registry.catalogs.map(item => [item.code, item]));
  const sections = new Map(registry.sections.map(item => [item.code, item]));
  const listed = instructions.filter(record => visible(record) && titled(record));
  const paths = new Map(
    entities.map(item => [
      item.code,
      getInstructionTaxonomyEntityPath(registry, item.kind, item.code),
    ]),
  );

  function reason(entity) {
    if (entity.kind === 'root') return entity.status === 'draft' ? 'legacy-root' : 'published';
    const parent = entity.kind === 'catalog' ? entity : catalogs.get(entity.parentCode);
    if (parent?.routeApproved === false) return 'route-unapproved';
    if (entity.status !== 'published') return 'draft';
    if (parent && parent.status !== 'published') return 'parent-draft';
    return 'published';
  }

  function members(entity) {
    return listed.filter(record => {
      if (entity.kind === 'root') return true;
      if (entity.kind === 'catalog')
        return sections.get(record.primaryCategoryId)?.parentCode === entity.code;
      if (entity.kind === 'section') return record.primaryCategoryId === entity.code;
      return record.tagIds?.includes(entity.code);
    });
  }

  const urls = entities.map(entity => {
    const path = paths.get(entity.code);
    const url = `${base}${path}`;
    const state = reason(entity);
    const isPublic = ['published', 'legacy-root'].includes(state);
    const legacyRoot = state === 'legacy-root';
    const count = members(entity).length;
    const canonicalUrl = legacyRoot ? url : entity.canonicalUrl || url;
    const indexable =
      isPublic &&
      (legacyRoot || (entity.indexingEnabled && count > 0 && new URL(canonicalUrl).href === url));
    return {
      kind: entity.kind,
      code: entity.code,
      name: entity.name,
      path,
      url,
      status: entity.status,
      public: isPublic,
      reason: state,
      expectedStatus: isPublic ? 200 : 404,
      count,
      totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
      canonicalUrl: isPublic ? canonicalUrl : null,
      robots: isPublic ? `${indexable ? 'index' : 'noindex'}, follow` : null,
      title: legacyRoot
        ? 'Инструкции по охране труда | БОЙКОВГРУПП'
        : entity.seoTitle || entity.h1 || entity.name,
      h1: legacyRoot ? 'Инструкции по охране труда' : entity.h1 || entity.name,
      description: legacyRoot
        ? 'Каталог инструкций по охране труда для работников различных профессий и видов работ.'
        : entity.seoDescription,
      indexable,
      inSitemap: indexable,
      expectedLinks: [],
    };
  });
  const entityRows = new Map(urls.map(row => [row.code, row]));
  const available = code => entityRows.get(code)?.public === true;
  const publicPath = code => (available(code) ? paths.get(code) : null);

  for (const entity of entities) {
    const row = entityRows.get(entity.code);
    if (!row.public) continue;
    const relatedEntities =
      entity.kind === 'root'
        ? entities.filter(item => item.kind !== 'root')
        : entity.kind === 'catalog'
          ? registry.sections.filter(item => item.parentCode === entity.code)
          : [];
    const sorted = members(entity)
      .filter(
        record => entity.kind !== 'root' || String(record.seoStatus).toLowerCase() !== 'noindex',
      )
      .sort(
        (a, b) =>
          a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }) || a.id.localeCompare(b.id),
      );
    row.expectedLinks = [
      ...new Set(
        [
          ...(entity.kind === 'root' ? [] : [ROOT_PATH]),
          ...(entity.kind === 'section' ? [publicPath(entity.parentCode)] : []),
          ...relatedEntities.map(item => publicPath(item.code)),
          ...sorted
            .slice(0, entity.kind === 'root' ? sorted.length : PAGE_SIZE)
            .map(getInstructionPublicPath),
        ].filter(Boolean),
      ),
    ];
    if (row.indexable && entity.status === 'published') {
      for (const field of ['seoTitle', 'seoDescription', 'h1']) {
        if (!entity[field])
          issues.push({
            severity: 'warning',
            code: 'missing-seo-field',
            url: row.url,
            detail: field,
          });
      }
    }
    if (entity.canonicalUrl && new URL(entity.canonicalUrl).origin !== base)
      issues.push({
        severity: 'warning',
        code: 'external-canonical',
        url: row.url,
        detail: entity.canonicalUrl,
      });
  }

  for (const record of instructions) {
    const path = getInstructionPublicPath(record);
    const isPublic = visible(record);
    const indexable =
      isPublic && titled(record) && String(record.seoStatus).toLowerCase() !== 'noindex';
    const section = sections.get(record.primaryCategoryId);
    const linked = [
      ROOT_PATH,
      section ? publicPath(section.parentCode) : null,
      publicPath(record.primaryCategoryId) ||
        (record.primaryCategoryId
          ? `${ROOT_PATH}?category=${encodeURIComponent(record.primaryCategoryId)}`
          : null),
      ...(record.tagIds || []).map(
        id => publicPath(id) || `${ROOT_PATH}?tag=${encodeURIComponent(id)}`,
      ),
    ].filter(Boolean);
    urls.push({
      kind: 'instruction',
      id: record.id,
      name: record.title || '',
      path,
      url: `${base}${path}`,
      public: isPublic,
      reason: isPublic ? 'published' : 'draft',
      expectedStatus: isPublic ? 200 : 404,
      canonicalUrl: isPublic ? `${base}${path}` : null,
      robots: isPublic
        ? `${String(record.seoStatus).toLowerCase() === 'noindex' ? 'noindex' : 'index'}, follow`
        : null,
      title: getInstructionSeo(record).title,
      h1: String(record.title || 'Инструкция по охране труда').trim(),
      description: getInstructionSeo(record).description,
      indexable,
      inSitemap: indexable,
      expectedLinks: [...new Set(linked)],
    });
  }

  const redirects = [];
  const redirectPaths = new Set();
  function redirect(path, row) {
    if (path === row.path || redirectPaths.has(path)) return;
    redirectPaths.add(path);
    redirects.push({
      path,
      url: `${base}${path}`,
      expectedStatus: row.public ? 301 : 404,
      location: row.public ? row.path : null,
    });
  }
  for (const historical of registry.redirects)
    redirect(historical.fromPath, entityRows.get(historical.code));
  for (const row of urls) {
    redirect(row.path.endsWith('/') ? row.path.slice(0, -1) : `${row.path}/`, row);
    if (row.kind !== 'instruction' && row.kind !== 'root') redirect(row.path.toUpperCase(), row);
  }
  for (const record of instructions) {
    const row = urls.find(item => item.kind === 'instruction' && item.id === record.id);
    for (const alias of new Set([record.id, ...(record.slugAliases || [])]))
      redirect(getInstructionPublicPath({ slug: alias }), row);
  }

  const technicalUrls = [];
  for (const row of urls.filter(item => item.public && item.kind !== 'instruction')) {
    for (const query of [
      'sort=newest',
      'q=__taxonomy_audit_no_match__',
      'utm_source=taxonomy-audit',
      ...(row.kind !== 'root' && row.totalPages > 1 ? ['page=2'] : []),
    ]) {
      technicalUrls.push({
        ...row,
        path: `${row.path}?${query}`,
        url: `${row.url}?${query}`,
        robots: 'noindex, follow',
        title: row.kind === 'root' ? null : row.title,
        h1: row.h1,
        inSitemap: false,
        indexable: false,
        expectedLinks: [],
      });
    }
    if (row.kind !== 'root')
      technicalUrls.push({
        ...row,
        path: `${row.path}?page=${row.totalPages + 1}`,
        url: `${row.url}?page=${row.totalPages + 1}`,
        expectedStatus: 404,
        canonicalUrl: null,
        robots: null,
        inSitemap: false,
        indexable: false,
        expectedLinks: [],
      });
  }
  const eligibleTitles = new Map();
  for (const row of urls.filter(item => item.indexable)) {
    const key = row.title.trim().toLocaleLowerCase('ru-RU');
    const previous = eligibleTitles.get(key);
    if (previous)
      issues.push({
        severity: 'warning',
        code: 'duplicate-seo-title',
        url: row.url,
        detail: previous,
      });
    else eligibleTitles.set(key, row.url);
  }
  for (const row of urls.filter(item => item.canonicalUrl)) {
    const target = new URL(row.canonicalUrl);
    const known = target.origin === base && urls.find(item => item.path === target.pathname);
    if (known && !known.public)
      issues.push({
        severity: 'error',
        code: 'canonical-to-unavailable-page',
        url: row.url,
        detail: known.url,
      });
  }
  const unapproved = registry.catalogs.filter(item => !item.routeApproved).map(item => item.code);
  if (unapproved.length)
    issues.push({
      severity: 'warning',
      code: 'unapproved-catalog-routes',
      detail: unapproved.join(', '),
    });
  const baseline = preservation(baselineInstructions, instructions, issues);
  return {
    schemaVersion: 1,
    scope: 'snapshot-model',
    origin: base,
    registryRevision: registry.revision,
    writesPerformed: false,
    counts: {
      catalogs: registry.catalogs.length,
      sections: registry.sections.length,
      tags: registry.tags.length,
      instructions: instructions.length,
      listedInstructions: listed.length,
      publicTaxonomyPages: urls.filter(item => item.kind !== 'instruction' && item.public).length,
      pendingTaxonomyPages: urls.filter(item => item.kind !== 'instruction' && !item.public).length,
      indexablePages: urls.filter(item => item.inSitemap).length,
      ...assignments,
      errors: issues.filter(item => item.severity === 'error').length,
      warnings: issues.filter(item => item.severity === 'warning').length,
    },
    urls,
    redirects,
    technicalUrls,
    sitemapUrls: [`${base}/`, ...urls.filter(row => row.inSitemap).map(row => row.url)],
    issues,
    baseline,
    sourceIssues: structuredClone(registry.sourceIssues),
    limitations: [
      'Expected snapshot model only; HTTP, Nginx and rendered HTML require the separate HTTP audit.',
      'No production database, import journal, backup availability or source CSV application is inferred.',
      'Preservation compares JSON fields only; referenced download files and their bytes are not checked.',
      'Use a consistent copied snapshot; this reader does not lock a running multi-file operation.',
      'Mobile layout, client navigation, search interactions and PDF purchase/download need manual browser checks.',
    ],
  };
}
