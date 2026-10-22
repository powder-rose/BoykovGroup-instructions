import { isDeepStrictEqual } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';
import { normalizeRichTextContent } from './richTextContent.js';

const BASE_PATH = '/instrukcii-po-ohrane-truda';
const CODE_PATTERN = /^[A-Z][A-Z0-9_-]{1,63}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const KINDS = new Set(['root', 'catalog', 'section', 'tag']);
const ENTITY_FIELDS = new Set([
  'code',
  'kind',
  'name',
  'slug',
  'parentCode',
  'h1',
  'seoTitle',
  'seoDescription',
  'introContent',
  'seoContent',
  'canonicalUrl',
  'status',
  'indexingEnabled',
  'sortOrder',
  'source',
]);
const STATE_FIELDS = new Set([
  'schemaVersion',
  'revision',
  'root',
  'catalogs',
  'sections',
  'tags',
  'redirects',
  'sourceIssues',
]);
const EMPTY_CONTENT = { type: 'doc', content: [] };

function invalid(message, cause) {
  throw new InstructionEditorError(message, { code: 'INVALID_TAXONOMY_REGISTRY', cause });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertFields(value, allowed, label) {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.has(key))) {
    invalid(`Invalid ${label} fields`);
  }
}

function text(value, label, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum) {
    invalid(`${label} must be a string of at most ${maximum} characters`);
  }
  const result = value.trim();
  if (required && !result) invalid(`${label} is required`);
  return result;
}

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(`${label} must be a nonnegative integer`);
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') invalid(`${label} must be a boolean`);
  return value;
}

function cloneProvenance(value, label) {
  const visiting = new Set();
  function check(item) {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!isRecord(item) && !Array.isArray(item)) invalid(`${label} must contain JSON values`);
    if (
      (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) ||
      visiting.has(item)
    ) {
      invalid(`${label} must contain acyclic JSON values`);
    }
    visiting.add(item);
    for (const child of Object.values(item)) check(child);
    visiting.delete(item);
  }
  check(value);
  return structuredClone(value);
}

function canonical(value) {
  const result = text(value, 'Canonical URL', 2048);
  if (!result) return result;
  let parsed;
  try {
    parsed = new URL(result);
  } catch (cause) {
    invalid('Canonical URL must be an absolute HTTP or HTTPS URL', cause);
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    /[\s\\?#]/u.test(result) ||
    [...result].some(
      character => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f,
    )
  ) {
    invalid('Canonical URL cannot contain credentials, whitespace, a query or a fragment');
  }
  return result;
}

function content(value, label) {
  try {
    return normalizeRichTextContent(value);
  } catch (cause) {
    invalid(`Invalid ${label}`, cause);
  }
}

export function normalizeInstructionTaxonomyEntity(kind, input) {
  if (!KINDS.has(kind)) invalid('Unknown taxonomy entity kind');
  const fields = kind === 'catalog' ? new Set([...ENTITY_FIELDS, 'routeApproved']) : ENTITY_FIELDS;
  assertFields(input, fields, 'taxonomy entity');
  if (input.kind !== undefined && input.kind !== kind)
    invalid('Taxonomy entity kind cannot change');

  const code = text(input.code, 'Code', 64, true);
  const slug = text(input.slug, 'Slug', 160, true);
  if (!CODE_PATTERN.test(code)) invalid('Code must be a stable uppercase technical identifier');
  if (!SLUG_PATTERN.test(slug))
    invalid('Slug must contain lowercase Latin letters, digits and hyphens');
  if (kind === 'catalog' && slug === 'temy') invalid('The temy namespace is reserved for tags');
  if (kind === 'root' && (code !== 'ROOT' || slug !== BASE_PATH.slice(1))) {
    invalid('The root catalog code and URL cannot change');
  }

  const parentCode =
    input.parentCode === undefined ? (kind === 'root' ? null : 'ROOT') : input.parentCode;
  if (
    kind === 'root'
      ? parentCode !== null
      : typeof parentCode !== 'string' ||
        (kind === 'section'
          ? !CODE_PATTERN.test(parentCode) || parentCode === 'ROOT'
          : parentCode !== 'ROOT')
  ) {
    invalid('Invalid taxonomy parent code');
  }
  const value = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const status = value('status', 'draft');
  if (!['draft', 'published'].includes(status)) invalid('Unknown taxonomy publication status');

  const entity = {
    code,
    kind,
    name: text(input.name, 'Name', 250, true),
    slug,
    parentCode,
    h1: text(value('h1', ''), 'H1', 250),
    seoTitle: text(value('seoTitle', ''), 'SEO title', 250),
    seoDescription: text(value('seoDescription', ''), 'SEO description', 500),
    introContent: content(value('introContent', EMPTY_CONTENT), 'introductory content'),
    seoContent: content(value('seoContent', EMPTY_CONTENT), 'SEO content'),
    canonicalUrl: canonical(value('canonicalUrl', '')),
    status,
    indexingEnabled: boolean(value('indexingEnabled', false), 'Indexing flag'),
    sortOrder: integer(value('sortOrder', 0), 'Sort order'),
  };
  if (kind === 'catalog')
    entity.routeApproved = boolean(value('routeApproved', false), 'Route approval');
  if (input.source !== undefined) {
    if (!isRecord(input.source)) invalid('Source provenance must be an object');
    entity.source = cloneProvenance(input.source, 'Source provenance');
  }
  return entity;
}

export function listInstructionTaxonomyEntities(state) {
  return [state.root, ...state.catalogs, ...state.sections, ...state.tags];
}

export function getInstructionTaxonomyEntityPath(state, kind, code) {
  const entity = listInstructionTaxonomyEntities(state).find(
    item => item.kind === kind && item.code === code,
  );
  if (!entity) return null;
  if (kind === 'root') return BASE_PATH;
  if (kind === 'catalog') return `${BASE_PATH}/${entity.slug}/`;
  if (kind === 'tag') return `${BASE_PATH}/temy/${entity.slug}/`;
  const catalog = state.catalogs.find(item => item.code === entity.parentCode);
  return catalog ? `${BASE_PATH}/${catalog.slug}/${entity.slug}/` : null;
}

export function validateInstructionTaxonomyRegistry(state) {
  assertFields(state, STATE_FIELDS, 'taxonomy registry');
  if (state.schemaVersion !== 1) invalid('Unsupported taxonomy registry schema version');
  integer(state.revision, 'Registry revision');
  for (const field of ['catalogs', 'sections', 'tags', 'redirects', 'sourceIssues']) {
    if (!Array.isArray(state[field])) invalid(`Registry ${field} must be an array`);
  }
  for (const [kind, entities] of [
    ['root', [state.root]],
    ['catalog', state.catalogs],
    ['section', state.sections],
    ['tag', state.tags],
  ]) {
    for (const entity of entities) {
      const normalized = normalizeInstructionTaxonomyEntity(kind, entity);
      if (!isDeepStrictEqual(entity, normalized))
        invalid('Stored taxonomy entities must be normalized');
    }
  }

  const entities = listInstructionTaxonomyEntities(state);
  const codes = new Set();
  const paths = new Set();
  const catalogs = new Map(state.catalogs.map(entity => [entity.code, entity]));
  for (const entity of entities) {
    if (codes.has(entity.code)) invalid(`Duplicate taxonomy code: ${entity.code}`);
    codes.add(entity.code);
    if (entity.kind === 'section' && !catalogs.has(entity.parentCode)) {
      invalid(`Unknown parent catalog: ${entity.parentCode}`);
    }
    const path = getInstructionTaxonomyEntityPath(state, entity.kind, entity.code);
    if (!path || paths.has(path)) invalid(`Duplicate or invalid taxonomy URL: ${path}`);
    paths.add(path);
    const catalog = entity.kind === 'catalog' ? entity : catalogs.get(entity.parentCode);
    if (entity.status === 'published' && catalog && !catalog.routeApproved) {
      invalid(`Catalog route requires explicit approval: ${catalog.code}`);
    }
  }

  const redirectPaths = new Set();
  for (const redirect of state.redirects) {
    assertFields(redirect, new Set(['fromPath', 'kind', 'code']), 'taxonomy redirect');
    if (
      typeof redirect.fromPath !== 'string' ||
      !/^\/instrukcii-po-ohrane-truda\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?\/$/u.test(
        redirect.fromPath,
      )
    ) {
      invalid('Redirect source must be a canonical local taxonomy URL');
    }
    if (!getInstructionTaxonomyEntityPath(state, redirect.kind, redirect.code)) {
      invalid('Redirect target taxonomy entity does not exist');
    }
    if (paths.has(redirect.fromPath) || redirectPaths.has(redirect.fromPath)) {
      invalid(`Redirect source conflicts with a reserved URL: ${redirect.fromPath}`);
    }
    redirectPaths.add(redirect.fromPath);
  }
  for (const issue of state.sourceIssues) {
    if (!isRecord(issue)) invalid('Source issues must be structured objects');
    cloneProvenance(issue, 'Source issue');
  }
  return true;
}
