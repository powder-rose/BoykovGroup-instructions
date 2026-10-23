import { InstructionEditorError } from './instructionEditorError.js';
import { getInstructionTaxonomyAssignmentCatalog } from './instructionTaxonomyAssignmentCatalog.js';
import { getInstructionTaxonomyDisplay } from './instructionTaxonomyDisplayService.js';
import {
  getInstructionTaxonomyEntityPath,
  validateInstructionTaxonomyRegistry,
} from './instructionTaxonomyRegistryModel.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import {
  assertInstructionVersionRecord,
  instructionsRepository,
} from './instructionsRepository.js';

const ROOT_PATH = '/instrukcii-po-ohrane-truda';
const ROOT_NAME = 'Инструкции по охране труда';
const PAGE_SIZE = 24;

function invalidQuery() {
  return new InstructionEditorError('Некорректные параметры страницы каталога', {
    code: 'INVALID_TAXONOMY_PUBLIC_QUERY',
  });
}

export function normalizeInstructionTaxonomyPublicOrigin(
  value = process.env.SITE_URL || 'https://boykovdocs.ru',
) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    // Configuration errors use the same explicit failure below.
  }
  if (
    typeof value !== 'string' ||
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    /[\s\\?#]/u.test(value) ||
    [...value].some(character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)
  ) {
    throw new InstructionEditorError('Для страниц каталога нужен корректный адрес сайта', {
      code: 'TAXONOMY_PUBLIC_ORIGIN_ERROR',
      status: 500,
    });
  }
  return parsed.origin;
}

function queryState(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.hasOwn(query, 'path'))
    throw invalidQuery();
  const entries = Object.entries(query);
  if (
    entries.length > 20 ||
    entries.some(
      ([key, value]) =>
        !key || key.length > 100 || typeof value !== 'string' || value.length > 2000,
    )
  )
    throw invalidQuery();
  const q = (query.q ?? '').trim();
  const sort = query.sort || 'title';
  const rawPage = query.page || '1';
  if (q.length > 200 || !['title', 'newest'].includes(sort) || !/^\d+$/u.test(rawPage))
    throw invalidQuery();
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1) throw invalidQuery();
  const normalized = {};
  if (q) normalized.q = q;
  if (sort !== 'title') normalized.sort = sort;
  if (page !== 1) normalized.page = String(page);
  for (const [key, value] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    if (!['q', 'sort', 'page'].includes(key) && value) normalized[key] = value;
  }
  const changed =
    entries.some(([key, value]) => normalized[key] !== value) ||
    Object.keys(normalized).some(key => !Object.hasOwn(query, key));
  return { q, sort, page, normalized, changed };
}

function queryPath(path, query, page = query.page) {
  const params = new URLSearchParams(query.normalized);
  if (page === 1) params.delete('page');
  else params.set('page', String(page));
  const search = params.toString();
  return `${path}${search ? `?${search}` : ''}`;
}

function normalizedPath(path) {
  if (
    typeof path !== 'string' ||
    path.length > 2048 ||
    !path.startsWith('/') ||
    /[?#\\\s]/u.test(path)
  )
    return null;
  try {
    if (/%(?:2f|5c)/iu.test(path)) return null;
    const decoded = decodeURIComponent(path);
    if (decoded.split('/').some(part => part === '.' || part === '..') || /[?#\\\s]/u.test(decoded))
      return null;
    return `${decoded.replace(/\/+$/u, '').toLowerCase()}/`;
  } catch {
    return null;
  }
}

function ordered(entities) {
  return [...entities].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

function publicationTime(record) {
  const value = record.publishedAt || record.createdAt || record.generatedAt || record.uploadedAt;
  return Date.parse(value) || 0;
}

export function createInstructionTaxonomyPublicService({
  repository = instructionsRepository,
  taxonomyRepository = instructionTaxonomyRegistryRepository,
} = {}) {
  return {
    snapshot() {
      const registry = structuredClone(taxonomyRepository.read());
      validateInstructionTaxonomyRegistry(registry);
      const read =
        typeof repository.getAllFresh === 'function' ? repository.getAllFresh : repository.getAll;
      if (typeof read !== 'function')
        throw new TypeError('A complete published instruction provider is required');
      const raw = read.call(repository);
      const ids = new Set();
      if (!Array.isArray(raw)) throw new TypeError('Published instructions must be an array');
      const records = raw
        .map(record => {
          assertInstructionVersionRecord(record, 'published');
          if (
            ids.has(record.id) ||
            (record.title !== undefined &&
              record.title !== null &&
              typeof record.title !== 'string') ||
            (record.slug !== undefined && record.slug !== null && typeof record.slug !== 'string')
          )
            throw new TypeError('Published instruction references are malformed or duplicated');
          ids.add(record.id);
          return {
            id: record.id,
            title: record.title,
            slug: record.slug,
            source: typeof record.source === 'string' ? record.source : undefined,
            status: typeof record.status === 'string' ? record.status : '',
            seoStatus: typeof record.seoStatus === 'string' ? record.seoStatus : '',
            primaryCategoryId: record.primaryCategoryId,
            tagIds: [...(record.tagIds ?? [])],
            ...Object.fromEntries(
              ['publishedAt', 'createdAt', 'generatedAt', 'uploadedAt'].map(field => [
                field,
                ['string', 'number'].includes(typeof record[field]) ? record[field] : null,
              ]),
            ),
          };
        })
        .filter(
          record =>
            typeof record.title === 'string' &&
            record.title.trim() &&
            String(record.status || '').toLowerCase() !== 'draft' &&
            String(record.seoStatus || '').toLowerCase() !== 'draft',
        );
      const catalogs = ordered(
        registry.catalogs.filter(entity => entity.status === 'published' && entity.routeApproved),
      );
      const catalogCodes = new Set(catalogs.map(entity => entity.code));
      const sections = ordered(
        registry.sections.filter(
          entity => entity.status === 'published' && catalogCodes.has(entity.parentCode),
        ),
      );
      const tags = ordered(registry.tags.filter(entity => entity.status === 'published'));
      const publicEntities = [...catalogs, ...sections, ...tags];
      const entityPaths = new Map(
        publicEntities.map(entity => [
          getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code),
          entity,
        ]),
      );
      const sectionCatalog = new Map(
        registry.sections.map(entity => [entity.code, entity.parentCode]),
      );
      const membership = new Map(
        publicEntities.map(entity => [
          entity.code,
          records.filter(record => {
            if (entity.kind === 'catalog')
              return sectionCatalog.get(record.primaryCategoryId) === entity.code;
            if (entity.kind === 'section') return record.primaryCategoryId === entity.code;
            return record.tagIds?.includes(entity.code);
          }),
        ]),
      );
      const assignmentCatalog = getInstructionTaxonomyAssignmentCatalog(registry);

      function minimal(entity) {
        return {
          code: entity.code,
          name: entity.name,
          path: getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code),
          count: membership.get(entity.code)?.length ?? 0,
        };
      }

      function seo(entity, origin, count, technical = false) {
        const path = getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code);
        const own = `${origin}${path}`;
        const canonicalUrl = entity.canonicalUrl || own;
        const indexable =
          entity.indexingEnabled && count > 0 && new URL(canonicalUrl).href === own && !technical;
        return {
          title: entity.seoTitle || entity.h1 || entity.name,
          description: entity.seoDescription,
          canonicalUrl,
          robots: indexable ? 'index, follow' : 'noindex, follow',
          indexable,
        };
      }

      function rootOverlay(origin) {
        const root = registry.root;
        if (root.status !== 'published') return null;
        return {
          siteUrl: origin,
          code: root.code,
          name: root.name,
          path: ROOT_PATH,
          h1: root.h1 || root.name,
          introContent: structuredClone(root.introContent),
          seoContent: structuredClone(root.seoContent),
          seo: seo(root, origin, records.length),
        };
      }

      function navigation(origin) {
        const base = normalizeInstructionTaxonomyPublicOrigin(origin);
        return {
          revision: registry.revision,
          root: rootOverlay(base),
          catalogs: catalogs.map(entity => ({
            ...minimal(entity),
            sections: sections.filter(section => section.parentCode === entity.code).map(minimal),
          })),
          tags: tags.map(minimal),
        };
      }

      function resolve(path, query = {}, origin) {
        const base = normalizeInstructionTaxonomyPublicOrigin(origin);
        const normalized = normalizedPath(path);
        if (!normalized || normalized === `${ROOT_PATH}/`) return { status: 404 };
        let entity = entityPaths.get(normalized);
        let historical = false;
        if (!entity) {
          const redirect = registry.redirects.find(item => item.fromPath === normalized);
          entity =
            redirect &&
            publicEntities.find(item => item.kind === redirect.kind && item.code === redirect.code);
          historical = Boolean(entity);
        }
        if (!entity) return { status: 404 };
        const state = queryState(query);
        const canonicalPath = getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code);
        if (historical || path !== canonicalPath || state.changed)
          return { status: 301, location: queryPath(canonicalPath, state) };
        const needle = state.q.toLocaleLowerCase('ru-RU');
        const matched = membership
          .get(entity.code)
          .filter(record => !needle || record.title.toLocaleLowerCase('ru-RU').includes(needle));
        matched.sort(
          (a, b) =>
            (state.sort === 'newest'
              ? publicationTime(b) - publicationTime(a)
              : a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })) ||
            a.id.localeCompare(b.id),
        );
        const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
        if (state.page > totalPages) return { status: 404 };
        const rootName = registry.root.status === 'published' ? registry.root.name : ROOT_NAME;
        const breadcrumbs = [
          { name: 'Главная', path: '/' },
          { name: rootName, path: ROOT_PATH },
        ];
        if (entity.kind === 'section') {
          const parent = catalogs.find(item => item.code === entity.parentCode);
          breadcrumbs.push({
            name: parent.name,
            path: getInstructionTaxonomyEntityPath(registry, parent.kind, parent.code),
          });
        }
        breadcrumbs.push({ name: entity.name, path: null });
        const items = matched
          .slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
          .map(record => ({
            id: record.id,
            title: record.title,
            slug: record.slug || record.id,
            ...(typeof record.source === 'string' ? { source: record.source } : {}),
            taxonomyDisplay: getInstructionTaxonomyDisplay(record, { catalog: assignmentCatalog }),
          }));
        const pages = [
          ...new Set([
            1,
            totalPages,
            ...Array.from({ length: 5 }, (_, index) => state.page + index - 2),
          ]),
        ]
          .filter(page => page >= 1 && page <= totalPages)
          .sort((a, b) => a - b);
        return {
          status: 200,
          page: {
            siteUrl: base,
            revision: registry.revision,
            kind: entity.kind,
            code: entity.code,
            name: entity.name,
            path: canonicalPath,
            h1: entity.h1 || entity.name,
            introContent: structuredClone(entity.introContent),
            seoContent: structuredClone(entity.seoContent),
            seo: seo(
              entity,
              base,
              membership.get(entity.code).length,
              Object.keys(state.normalized).length > 0,
            ),
            breadcrumbs,
            sections:
              entity.kind === 'catalog'
                ? sections.filter(section => section.parentCode === entity.code).map(minimal)
                : [],
            items,
            total: matched.length,
            page: state.page,
            pageSize: PAGE_SIZE,
            totalPages,
            query: state.q,
            sort: state.sort,
            pagination: pages.map(page => ({
              page,
              path: queryPath(canonicalPath, state, page),
            })),
            previousPath: state.page > 1 ? queryPath(canonicalPath, state, state.page - 1) : null,
            nextPath:
              state.page < totalPages ? queryPath(canonicalPath, state, state.page + 1) : null,
          },
        };
      }

      function sitemap(origin) {
        const base = normalizeInstructionTaxonomyPublicOrigin(origin);
        const root = rootOverlay(base);
        const entries =
          !root || root.seo.indexable ? [{ path: ROOT_PATH, loc: `${base}${ROOT_PATH}` }] : [];
        for (const entity of publicEntities) {
          const metadata = seo(entity, base, membership.get(entity.code).length);
          if (metadata.indexable) {
            const path = getInstructionTaxonomyEntityPath(registry, entity.kind, entity.code);
            entries.push({ path, loc: `${base}${path}` });
          }
        }
        return entries;
      }

      return {
        assignmentCatalog: structuredClone(assignmentCatalog),
        navigation,
        resolve,
        sitemap,
      };
    },
  };
}

export const instructionTaxonomyPublicService = createInstructionTaxonomyPublicService();
