import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  getInstructionTaxonomyEntityPath,
  listInstructionTaxonomyEntities,
  validateInstructionTaxonomyRegistry,
} from './instructionTaxonomyRegistryModel.js';
import { getInstructionTaxonomyRegistrySeed } from './instructionTaxonomySource.js';
import { InstructionEditorError } from './instructionEditorError.js';
import { updateInstructionTaxonomyRedirects } from './instructionTaxonomyRegistryService.js';

export function taxonomyPublicationHash(state) {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

function conflict(message) {
  throw new InstructionEditorError(message, { status: 409, code: 'TAXONOMY_PUBLICATION_CONFLICT' });
}

/** Activate the supplied structure without generating copy or opening new pages to indexing. */
export function buildInstructionTaxonomyPublication(before) {
  validateInstructionTaxonomyRegistry(before);
  const seed = getInstructionTaxonomyRegistrySeed();
  const after = structuredClone(before);
  for (const collection of ['catalogs', 'sections', 'tags']) {
    for (const initial of seed[collection]) {
      let entity = after[collection].find(item => item.code === initial.code);
      if (!entity) {
        if (listInstructionTaxonomyEntities(after).some(item => item.code === initial.code)) {
          conflict(`Код занят другим типом элемента: ${initial.code}`);
        }
        entity = structuredClone(initial);
        after[collection].push(entity);
      }
      if (entity.parentCode !== initial.parentCode)
        conflict(`Изменён родитель элемента: ${entity.code}`);
      if (entity.status !== 'published') entity.indexingEnabled = false;
      entity.status = 'published';
      if (entity.kind === 'catalog') entity.routeApproved = true;
    }
  }
  // The specification selects the shorter route; published historical routes retain redirects.
  after.catalogs.find(item => item.code === 'H01').slug = 'po-professiyam';
  for (const entity of listInstructionTaxonomyEntities(before)) {
    const oldPath = getInstructionTaxonomyEntityPath(before, entity.kind, entity.code);
    const newPath = getInstructionTaxonomyEntityPath(after, entity.kind, entity.code);
    if (oldPath === newPath || entity.canonicalUrl !== `https://boykovdocs.ru${oldPath}`) continue;
    listInstructionTaxonomyEntities(after).find(item => item.code === entity.code).canonicalUrl =
      `https://boykovdocs.ru${newPath}`;
  }
  if (after.root.status !== 'published') {
    after.root.status = 'published';
    after.root.indexingEnabled = true;
    after.root.seoTitle ||= 'Инструкции по охране труда | БОЙКОВГРУПП';
    after.root.seoDescription ||=
      'Каталог инструкций по охране труда для работников различных профессий и видов работ.';
  }
  updateInstructionTaxonomyRedirects(before, after);
  const previous = new Map(
    listInstructionTaxonomyEntities(before).map(entity => [entity.code, entity]),
  );
  const changes = listInstructionTaxonomyEntities(after)
    .filter(entity => !isDeepStrictEqual(previous.get(entity.code), entity))
    .map(entity => ({
      code: entity.code,
      kind: entity.kind,
      path: getInstructionTaxonomyEntityPath(after, entity.kind, entity.code),
      status: entity.status,
      indexingEnabled: entity.indexingEnabled,
    }));
  after.revision = before.revision + (changes.length ? 1 : 0);
  validateInstructionTaxonomyRegistry(after);
  const urls = listInstructionTaxonomyEntities(after).map(entity => ({
    code: entity.code,
    kind: entity.kind,
    path: getInstructionTaxonomyEntityPath(after, entity.kind, entity.code),
    status: entity.status,
    indexingEnabled: entity.indexingEnabled,
  }));
  return {
    schemaVersion: 1,
    operation: 'publish-taxonomy-structure',
    before: structuredClone(before),
    after,
    beforeHash: taxonomyPublicationHash(before),
    afterHash: taxonomyPublicationHash(after),
    changes,
    urls,
  };
}

export function validateInstructionTaxonomyPublication(plan) {
  if (!plan || plan.schemaVersion !== 1 || plan.operation !== 'publish-taxonomy-structure') {
    conflict('Некорректный план публикации');
  }
  const expected = buildInstructionTaxonomyPublication(plan.before);
  if (!isDeepStrictEqual(expected, plan))
    conflict('План публикации изменён. Создайте новый предпросмотр.');
  return plan;
}

export function applyInstructionTaxonomyPublication(
  repository,
  supplied,
  { rollback = false } = {},
) {
  const plan = validateInstructionTaxonomyPublication(supplied);
  const current = repository.read();
  const expectedHash = rollback ? plan.afterHash : plan.beforeHash;
  const destination = rollback ? plan.before : plan.after;
  if (taxonomyPublicationHash(current) !== expectedHash) {
    conflict('Справочник изменился после предпросмотра. Повторите проверку.');
  }
  if (!plan.changes.length) return current;
  return repository.update(
    state => {
      if (taxonomyPublicationHash(state) !== expectedHash)
        conflict('Справочник изменился перед сохранением.');
      return structuredClone(destination);
    },
    { expectedRevision: current.revision },
  );
}
