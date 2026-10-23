import { InstructionEditorError } from './instructionEditorError.js';
import {
  getInstructionTaxonomyEntityPath,
  listInstructionTaxonomyEntities,
  normalizeInstructionTaxonomyEntity,
} from './instructionTaxonomyRegistryModel.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import { getLegacyInstructionTaxonomyCatalog } from './instructionTaxonomySource.js';

const COLLECTIONS = { catalog: 'catalogs', section: 'sections', tag: 'tags' };

function collectionFor(kind) {
  return Object.hasOwn(COLLECTIONS, kind) ? COLLECTIONS[kind] : undefined;
}

const EDITABLE = new Set([
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
]);

function invalid(message, code = 'INVALID_INSTRUCTION_TAXONOMY_REGISTRY', details) {
  const error = new InstructionEditorError(message, { code });
  if (details) error.details = details;
  return error;
}

function findEntity(state, kind, code) {
  if (kind === 'root' && code === state.root.code) return state.root;
  const collection = collectionFor(kind);
  return collection ? state[collection].find(entity => entity.code === code) : undefined;
}

function requireEntity(state, kind, code) {
  const entity = findEntity(state, kind, code);
  if (!entity) {
    throw new InstructionEditorError('Элемент структуры не найден', {
      status: 404,
      code: 'TAXONOMY_ENTITY_NOT_FOUND',
    });
  }
  return entity;
}

function assertPatch(input, creating = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Некорректные данные элемента структуры');
  }
  for (const field of Object.keys(input)) {
    if (!EDITABLE.has(field) && !(creating && field === 'code')) {
      throw invalid(`Поле нельзя изменять: ${field}`);
    }
  }
}

function updateRedirects(before, next) {
  const paths = new Map(
    listInstructionTaxonomyEntities(next).map(entity => [
      getInstructionTaxonomyEntityPath(next, entity.kind, entity.code),
      entity,
    ]),
  );
  const redirects = new Map(next.redirects.map(item => [item.fromPath, item]));
  for (const [fromPath, redirect] of redirects) {
    const occupant = paths.get(fromPath);
    if (occupant?.code === redirect.code && occupant.kind === redirect.kind) {
      redirects.delete(fromPath);
    }
  }
  for (const entity of listInstructionTaxonomyEntities(before)) {
    if (entity.status !== 'published' || !findEntity(next, entity.kind, entity.code)) continue;
    const fromPath = getInstructionTaxonomyEntityPath(before, entity.kind, entity.code);
    const toPath = getInstructionTaxonomyEntityPath(next, entity.kind, entity.code);
    if (fromPath !== toPath) {
      const existing = redirects.get(fromPath);
      if (existing && (existing.code !== entity.code || existing.kind !== entity.kind)) {
        throw invalid('Старый адрес уже закреплён за другим элементом', 'TAXONOMY_URL_CONFLICT');
      }
      redirects.set(fromPath, { fromPath, kind: entity.kind, code: entity.code });
    }
  }
  next.redirects = [...redirects.values()];
}

export function createInstructionTaxonomyRegistryService({
  repository = instructionTaxonomyRegistryRepository,
  getInstructions,
} = {}) {
  if (typeof getInstructions !== 'function') {
    throw new TypeError('A complete instruction-reference provider is required');
  }
  const legacy = getLegacyInstructionTaxonomyCatalog();

  function usage(state, kind, code) {
    requireEntity(state, kind, code);
    const instructions = getInstructions();
    if (!Array.isArray(instructions))
      throw new TypeError('Instruction references must be an array');
    if (
      instructions.some(
        instruction =>
          !instruction ||
          typeof instruction !== 'object' ||
          Array.isArray(instruction) ||
          typeof instruction.id !== 'string' ||
          !instruction.id.trim() ||
          (instruction.tagIds !== undefined &&
            instruction.tagIds !== null &&
            (!Array.isArray(instruction.tagIds) ||
              instruction.tagIds.some(id => typeof id !== 'string'))) ||
          (instruction.primaryCategoryId !== undefined &&
            instruction.primaryCategoryId !== null &&
            typeof instruction.primaryCategoryId !== 'string'),
      )
    )
      throw new TypeError('Instruction references contain malformed records');
    const sections = new Set(
      state.sections
        .filter(section => kind === 'root' || section.parentCode === code)
        .map(section => section.code),
    );
    const references = instructions.filter(instruction => {
      if (kind === 'root') return true;
      if (kind === 'catalog') return sections.has(instruction.primaryCategoryId);
      if (kind === 'section') return instruction.primaryCategoryId === code;
      return Array.isArray(instruction.tagIds) && instruction.tagIds.includes(code);
    });
    return {
      references: new Set(references.map(instruction => instruction.id)).size,
      publishedInstructions: new Set(
        references
          .filter(
            instruction => instruction.status !== 'draft' && instruction.seoStatus !== 'draft',
          )
          .map(instruction => instruction.id),
      ).size,
    };
  }

  function assertIndexing(state, entity) {
    if (
      entity.status === 'published' &&
      entity.indexingEnabled &&
      usage(state, entity.kind, entity.code).publishedInstructions === 0
    ) {
      throw invalid('Пустую страницу нельзя публиковать с индексацией', 'TAXONOMY_EMPTY_PAGE');
    }
  }

  function change(expectedRevision, mutate) {
    return repository.update(
      state => {
        const before = structuredClone(state);
        mutate(state);
        updateRedirects(before, state);
        return state;
      },
      { expectedRevision },
    );
  }

  return {
    read() {
      return { ...repository.read(), legacyCatalog: structuredClone(legacy) };
    },

    get(kind, code) {
      return structuredClone(requireEntity(repository.read(), kind, code));
    },

    getUsage(kind, code) {
      return usage(repository.read(), kind, code);
    },

    create(kind, input, { expectedRevision } = {}) {
      if (!collectionFor(kind)) throw invalid('Этот тип элемента нельзя создавать');
      assertPatch(input, true);
      return change(expectedRevision, state => {
        if (listInstructionTaxonomyEntities(state).some(entity => entity.code === input.code)) {
          throw invalid('Код уже используется', 'TAXONOMY_CODE_CONFLICT');
        }
        const entity = normalizeInstructionTaxonomyEntity(kind, input);
        state[collectionFor(kind)].push(entity);
        assertIndexing(state, entity);
      });
    },

    update(kind, code, patch, { expectedRevision } = {}) {
      assertPatch(patch);
      return change(expectedRevision, state => {
        const current = requireEntity(state, kind, code);
        const previousParentCode = current.parentCode;
        const next = normalizeInstructionTaxonomyEntity(kind, { ...current, ...patch });
        Object.assign(current, next);
        assertIndexing(state, current);
        if (kind === 'section' && previousParentCode !== current.parentCode) {
          assertIndexing(state, requireEntity(state, 'catalog', previousParentCode));
        }
      });
    },

    confirmCatalogRoute(code, slug, { expectedRevision } = {}) {
      return change(expectedRevision, state => {
        const current = requireEntity(state, 'catalog', code);
        Object.assign(
          current,
          normalizeInstructionTaxonomyEntity('catalog', {
            ...current,
            slug,
            routeApproved: true,
          }),
        );
      });
    },

    remove(kind, code, { expectedRevision } = {}) {
      if (!collectionFor(kind)) throw invalid('Общий каталог нельзя удалить');
      return change(expectedRevision, state => {
        requireEntity(state, kind, code);
        const count = usage(state, kind, code).references;
        const children =
          kind === 'catalog'
            ? state.sections
                .filter(section => section.parentCode === code)
                .map(section => section.code)
            : [];
        if (count || children.length) {
          throw invalid(
            'Сначала перенесите связанные инструкции или разделы',
            'TAXONOMY_ENTITY_IN_USE',
            { references: count, sections: children },
          );
        }
        state[collectionFor(kind)] = state[collectionFor(kind)].filter(
          entity => entity.code !== code,
        );
        state.redirects = state.redirects.filter(item => item.kind !== kind || item.code !== code);
      });
    },

    validateAssignment(input, { requireSection = false } = {}) {
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some(key => !['primaryCategoryId', 'tagIds'].includes(key))
      )
        throw invalid('Передайте основной раздел и теги без отдельного поля каталога');
      const state = repository.read();
      const primaryCategoryId = input.primaryCategoryId ?? null;
      const section = state.sections.find(item => item.code === primaryCategoryId);
      const oldCategory = legacy.categories.find(item => item.id === primaryCategoryId);
      if (
        (primaryCategoryId !== null && !section && !oldCategory) ||
        (requireSection && !section)
      ) {
        throw invalid('Выберите один основной тематический раздел');
      }
      const tagIds = input.tagIds ?? [];
      if (!Array.isArray(tagIds) || new Set(tagIds).size !== tagIds.length) {
        throw invalid('Теги должны быть списком без повторений');
      }
      const known = new Set([
        ...state.tags.map(tag => tag.code),
        ...legacy.tags.map(tag => tag.id),
      ]);
      if (tagIds.some(id => typeof id !== 'string' || !known.has(id))) {
        throw invalid('Выбран неизвестный тег');
      }
      return { primaryCategoryId, tagIds: [...tagIds], catalogCode: section?.parentCode ?? null };
    },

    inspectInstruction(instruction) {
      const state = repository.read();
      const section = state.sections.find(item => item.code === instruction?.primaryCategoryId);
      const oldCategory = legacy.categories.find(
        item => item.id === instruction?.primaryCategoryId,
      );
      const codedTags = new Map(state.tags.map(tag => [tag.code, tag]));
      const legacyTags = new Map(legacy.tags.map(tag => [tag.id, tag]));
      const tags = [...new Set(Array.isArray(instruction?.tagIds) ? instruction.tagIds : [])]
        .map(id => codedTags.get(id) || legacyTags.get(id))
        .filter(Boolean);
      return structuredClone({
        catalog: section ? state.catalogs.find(item => item.code === section.parentCode) : null,
        section: section ?? null,
        legacyCategory: oldCategory ?? null,
        tags,
      });
    },
  };
}
