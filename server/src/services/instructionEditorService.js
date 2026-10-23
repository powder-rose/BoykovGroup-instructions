import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { slugify } from '../utils/slug.js';
import {
  getInstructionDocument,
  getInstructionSeo,
  instructionDocumentToLegacy,
  richTextToPlainText,
} from '../shared/instructionDocument.js';
import {
  DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
  instructionsRepository,
  readInstructionVersionDirectory,
  readInstructionVersionFile,
} from './instructionsRepository.js';
import { getInstructionTaxonomyDisplay } from './instructionTaxonomyDisplayService.js';
import { applyInstructionTaxonomyEditorPatch } from './instructionTaxonomyEditor.js';
import {
  getInstructionTaxonomyAssignmentCatalog,
  validateInstructionTaxonomyAssignment,
} from './instructionTaxonomyAssignmentCatalog.js';
import { instructionTaxonomyRegistryRepository } from './instructionTaxonomyRegistryRepository.js';
import { saveInstructionSnapshot } from './instructionHistoryService.js';
import { normalizeProfessionKey } from './professionNormalizer.js';
import { createInstructionHash } from './instructionHashService.js';
import { rankRelatedInstructions } from './instructionRelatedService.js';
import { normalizeRichTextContent } from './richTextContent.js';
import { InstructionEditorError } from './instructionEditorError.js';
import {
  getInstructionEditorialMeta,
  updateInstructionEditorialMeta,
} from './instructionEditorialMeta.js';

const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function revisionOf(instruction) {
  return Number.isInteger(instruction?.revision) ? instruction.revision : 0;
}

function notFound() {
  return new InstructionEditorError('Инструкция не найдена', {
    status: 404,
    code: 'INSTRUCTION_NOT_FOUND',
  });
}

function textField(value, label, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum) {
    throw new InstructionEditorError(`${label}: допустимо не больше ${maximum} символов`);
  }

  const result = value.trim();

  if (required && !result) {
    throw new InstructionEditorError(`Заполните поле «${label}»`);
  }

  return result;
}

function assertRevision(actual, expected) {
  if (!Number.isInteger(expected) || expected < 0) {
    throw new InstructionEditorError('Передайте номер сохранённой версии инструкции');
  }

  if (actual !== expected) {
    throw new InstructionEditorError('Инструкция уже изменена. Загрузите актуальную версию.', {
      status: 409,
      code: 'INSTRUCTION_REVISION_CONFLICT',
    });
  }
}

function uniqueAliases(values, slug) {
  return [...new Set(values.filter(value => typeof value === 'string' && value && value !== slug))];
}

export function instructionSummary(instruction) {
  return {
    id: instruction.id,
    slug: instruction.slug || instruction.id,
    title: instruction.title,
    profession: instruction.profession,
    source: instruction.source,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
    revision: revisionOf(instruction),
    status: instruction.status || 'published',
  };
}

export function getRelatedInstructions(
  instruction,
  {
    limit = 8,
    repository = instructionsRepository,
    catalog = getInstructionTaxonomyAssignmentCatalog(),
    records,
  } = {},
) {
  const published =
    records ??
    (typeof repository.getPublicReferencesFresh === 'function'
      ? repository.getPublicReferencesFresh()
      : typeof repository.getAllFresh === 'function'
        ? repository.getAllFresh()
        : repository.getAll());

  return rankRelatedInstructions(instruction, published, { limit, catalog }).map(
    instructionSummary,
  );
}

export function createInstructionEditorService({
  repository = instructionsRepository,
  draftsDirectory = DEFAULT_INSTRUCTION_DRAFTS_DIRECTORY,
  saveSnapshot = saveInstructionSnapshot,
  taxonomyRepository = instructionTaxonomyRegistryRepository,
} = {}) {
  function refreshPublished() {
    if (typeof repository.getAllFresh === 'function') repository.getAllFresh();
  }

  function mutate(operation) {
    return taxonomyRepository.withLock(
      (registry, assertHeld) => {
        refreshPublished();
        return operation(registry, assertHeld);
      },
      { waitMs: 5000 },
    );
  }

  function draftPath(id) {
    return path.join(
      draftsDirectory,
      `${Buffer.from(String(id), 'utf8').toString('base64url')}.json`,
    );
  }

  function readDraftFile(filePath) {
    return readInstructionVersionFile(filePath, 'draft', { allowMissing: true })?.record ?? null;
  }

  function readDraft(id) {
    return readDraftFile(draftPath(id));
  }

  function allDrafts() {
    return readInstructionVersionDirectory(draftsDirectory, 'draft').map(
      snapshot => snapshot.record,
    );
  }

  function writeDraft(instruction, assertHeld) {
    const target = draftPath(instruction.id);
    const temporary = path.join(draftsDirectory, `.${path.basename(target)}.${randomUUID()}.tmp`);

    try {
      fs.mkdirSync(draftsDirectory, { recursive: true });
      fs.writeFileSync(temporary, `${JSON.stringify(instruction, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flush: true,
      });
      assertHeld();
      fs.renameSync(temporary, target);
    } catch (cause) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch (cleanupError) {
        console.error('[Instructions] Failed to clean unfinished draft:', cleanupError);
      }

      if (cause instanceof InstructionEditorError) throw cause;
      throw new InstructionEditorError('Не удалось сохранить черновик инструкции', {
        status: 500,
        code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
        cause,
      });
    }
  }

  function removeDraft(id) {
    fs.rmSync(draftPath(id), { force: true });
  }

  function state(id) {
    const published = repository.getById(id);
    const savedDraft = readDraft(id);
    const draft =
      savedDraft && (!published || revisionOf(savedDraft) > revisionOf(published))
        ? savedDraft
        : null;
    const editable = draft || published;

    if (!editable) throw notFound();

    return {
      published,
      draft,
      editable,
      revision: Math.max(revisionOf(published), revisionOf(draft)),
    };
  }

  function editorView({ published, draft, editable, revision }, registry) {
    const seo = getInstructionSeo(editable);

    return {
      instruction: {
        ...structuredClone(editable),
        slug: editable.slug || editable.id,
        webIntro: editable.webIntro || '',
        instructionContent: getInstructionDocument(editable),
        explanationContent: editable.explanationContent || structuredClone(EMPTY_DOCUMENT),
        seoTitle: editable.seoTitle ?? seo.title,
        seoDescription: editable.seoDescription ?? seo.description,
        status: draft ? 'draft' : 'published',
        revision,
        editorialMeta: getInstructionEditorialMeta(editable),
        taxonomyDisplay: getInstructionTaxonomyDisplay(
          editable,
          registry
            ? {
                catalog: getInstructionTaxonomyAssignmentCatalog(registry),
              }
            : undefined,
        ),
      },
      hasDraft: Boolean(draft),
      hasPublishedVersion: Boolean(published),
      publicSlug: published ? published.slug || published.id : null,
      publishedEditorialMeta: published ? getInstructionEditorialMeta(published) : null,
    };
  }

  function checkSlug(id, slug, aliases = []) {
    const proposed = new Set([slug, ...aliases]);

    if (
      id !== 'instruktsiya-po-ohrane-truda-dlya-sistemnogo-administratora-CfhwZb' &&
      proposed.has('sistemnyy-administrator')
    ) {
      throw new InstructionEditorError(
        'Этот адрес используется перенаправлением существующей инструкции',
        {
          status: 409,
          code: 'INSTRUCTION_SLUG_CONFLICT',
        },
      );
    }

    const records = [...repository.getAll(), ...allDrafts()];

    for (const record of records) {
      if (record.id === id) continue;

      const reserved = [record.id, record.slug || record.id, ...(record.slugAliases || [])];

      if (reserved.some(value => proposed.has(value))) {
        throw new InstructionEditorError('Этот адрес уже занят другой инструкцией', {
          status: 409,
          code: 'INSTRUCTION_SLUG_CONFLICT',
        });
      }
    }
  }

  function normalize(input, existing) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new InstructionEditorError('Некорректные данные инструкции');
    }

    if (Object.hasOwn(input, 'seoReady') && typeof input.seoReady !== 'boolean') {
      throw new InstructionEditorError('Готовность SEO должна быть значением true или false');
    }

    for (const [field, label] of [
      ['seoAuthor', 'Автор SEO-подготовки'],
      ['contentAuthor', 'Автор текста инструкции'],
    ]) {
      if (Object.hasOwn(input, field)) {
        const author = typeof input[field] === 'string' ? input[field].trim() : input[field];
        textField(author, label, 120);
      }
    }

    const title = textField(input.title ?? existing?.title ?? '', 'Заголовок', 200, true);
    const requestedSlug =
      typeof input.slug === 'string' && input.slug.trim() === ''
        ? existing?.slug || existing?.id || slugify(title)
        : (input.slug ?? existing?.slug ?? existing?.id ?? slugify(title));
    const slug = textField(requestedSlug, 'Адрес', 1000, true);

    // Existing IDs may contain uppercase nanoid characters. Their historic URL remains valid.
    const legacySlug =
      existing &&
      [existing.slug || existing.id, existing.id, ...(existing.slugAliases || [])].includes(slug);

    if (!legacySlug && (!SLUG_PATTERN.test(slug) || slug.length > 160)) {
      throw new InstructionEditorError(
        'Адрес должен содержать латинские строчные буквы, цифры и одиночные дефисы',
      );
    }

    const status = input.status ?? 'draft';

    if (!['draft', 'published'].includes(status)) {
      throw new InstructionEditorError('Неизвестный статус инструкции');
    }

    const instructionContent = normalizeRichTextContent(
      input.instructionContent ?? (existing ? getInstructionDocument(existing) : EMPTY_DOCUMENT),
    );
    const explanationContent = normalizeRichTextContent(
      input.explanationContent ?? existing?.explanationContent ?? EMPTY_DOCUMENT,
    );
    const seo = existing ? getInstructionSeo(existing) : {};
    const seoTitle = textField(
      input.seoTitle ?? existing?.seoTitle ?? seo.title ?? '',
      'SEO-заголовок',
      200,
    );
    const seoDescription = textField(
      input.seoDescription ?? existing?.seoDescription ?? seo.description ?? '',
      'SEO-описание',
      400,
    );

    if (
      status === 'published' &&
      (!seoTitle || !seoDescription || !richTextToPlainText(instructionContent).trim())
    ) {
      throw new InstructionEditorError(
        'Для публикации заполните SEO-заголовок, SEO-описание и основной текст инструкции',
      );
    }

    return {
      title,
      slug,
      status,
      webIntro: textField(
        input.webIntro ?? existing?.webIntro ?? '',
        'Вводный текст страницы',
        2000,
      ),
      seoTitle,
      seoDescription,
      instructionContent,
      explanationContent,
    };
  }

  const service = {
    getTaxonomyReferences() {
      const published =
        typeof repository.getTaxonomyReferences === 'function'
          ? repository.getTaxonomyReferences()
          : repository.getAll();
      return [...published, ...allDrafts()].map(instruction =>
        structuredClone({
          id: instruction.id,
          status: instruction.status,
          seoStatus: instruction.seoStatus,
          primaryCategoryId: instruction.primaryCategoryId,
          tagIds: instruction.tagIds,
        }),
      );
    },

    list() {
      refreshPublished();
      const ids = new Set([...repository.getAll(), ...allDrafts()].map(item => item.id));
      const registry = taxonomyRepository.read();

      return [...ids]
        .map(id => {
          const view = editorView(state(id), registry);

          return {
            ...instructionSummary(view.instruction),
            hasDraft: view.hasDraft,
            hasPublishedVersion: view.hasPublishedVersion,
            publicSlug: view.publicSlug,
            editorialMeta: view.instruction.editorialMeta,
            publishedEditorialMeta: view.publishedEditorialMeta,
          };
        })
        .sort((a, b) =>
          String(b.updatedAt || b.createdAt || '').localeCompare(
            String(a.updatedAt || a.createdAt || ''),
          ),
        );
    },

    get(id) {
      refreshPublished();
      return editorView(state(id), taxonomyRepository.read());
    },

    save(id, input) {
      return mutate((registry, assertHeld) => {
        const previous = id ? state(id) : null;

        if (previous) assertRevision(previous.revision, input?.revision);

        const values = normalize(input, previous?.editable);
        const stableId = id || `instruction-${randomUUID()}`;
        const published = previous?.published;
        const aliases = uniqueAliases(
          [
            stableId,
            ...(previous?.editable.slugAliases || []),
            ...(published?.slugAliases || []),
            published?.slug || published?.id,
          ],
          values.slug,
        );

        checkSlug(stableId, values.slug, aliases);

        const now = new Date().toISOString();
        const profession = previous?.editable.profession || titleProfession(values.title);
        const legacy = instructionDocumentToLegacy(values.instructionContent);
        const instruction = applyInstructionTaxonomyEditorPatch(
          {
            ...previous?.editable,
            ...values,
            ...legacy,
            id: stableId,
            slugAliases: aliases,
            profession,
            professionKey: previous?.editable.professionKey || normalizeProfessionKey(profession),
            source: previous?.editable.source || 'manual',
            createdAt: previous?.editable.createdAt || now,
            updatedAt: now,
            revision: (previous?.revision || 0) + 1,
            version: published?.version || previous?.editable.version || '1.0',
          },
          input.taxonomyPatch,
          { registry },
        );

        validateInstructionTaxonomyAssignment(
          {
            primaryCategoryId: instruction.primaryCategoryId,
            tagIds: instruction.tagIds,
          },
          { registry, requireSection: !previous },
        );

        instruction.contentHash = createInstructionHash(instruction);
        instruction.editorialMeta = updateInstructionEditorialMeta(
          previous?.editable,
          instruction,
          {
            seoReady: input.seoReady,
            seoAuthor: input.seoAuthor,
            contentAuthor: input.contentAuthor,
            now,
          },
        );

        if (values.status === 'draft') {
          writeDraft(instruction, assertHeld);
        } else {
          const lastPublication =
            published || (previous?.editable.publishedAt ? previous.editable : null);

          instruction.version = lastPublication
            ? (Number(lastPublication.version || '1.0') + 0.1).toFixed(1)
            : '1.0';
          instruction.publishedAt =
            lastPublication?.publishedAt || lastPublication?.createdAt || now;

          assertHeld();
          if (published) saveSnapshot(published);

          assertHeld();
          repository.save(instruction, { assertHeld });

          // A leftover older draft is ignored by state() if cleanup itself fails.
          try {
            assertHeld();
            removeDraft(stableId);
          } catch (error) {
            console.error(
              '[Instructions] Published successfully; failed to remove old draft:',
              error,
            );
          }
        }

        return editorView(state(stableId), registry);
      });
    },

    remove(id, { revision } = {}) {
      return mutate((_registry, assertHeld) => {
        const current = state(id);

        assertRevision(current.revision, revision);
        assertHeld();
        if (current.published) repository.remove(id, { assertHeld });

        try {
          assertHeld();
          removeDraft(id);
        } catch (error) {
          assertHeld();
          if (current.published) repository.save(current.published, { assertHeld });
          throw error;
        }
      });
    },

    discardDraft(id, { revision } = {}) {
      return mutate((registry, assertHeld) => {
        const current = state(id);

        assertRevision(current.revision, revision);

        if (current.published && current.draft) {
          validateInstructionTaxonomyAssignment(
            {
              primaryCategoryId: current.published.primaryCategoryId,
              tagIds: current.published.tagIds,
            },
            { registry },
          );
          assertHeld();
          repository.save({ ...current.published, revision: current.revision + 1 }, { assertHeld });
        }

        assertHeld();
        removeDraft(id);

        return current.published ? editorView(state(id), registry) : null;
      });
    },

    unpublish(id, { revision } = {}) {
      return mutate((registry, assertHeld) => {
        const current = state(id);

        assertRevision(current.revision, revision);

        if (!current.published) return editorView(current, registry);

        const draft = {
          ...current.editable,
          status: 'draft',
          publishedAt: current.published.publishedAt || current.published.createdAt,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };

        validateInstructionTaxonomyAssignment(
          {
            primaryCategoryId: draft.primaryCategoryId,
            tagIds: draft.tagIds,
          },
          { registry },
        );
        writeDraft(draft, assertHeld);
        assertHeld();
        repository.remove(id, { assertHeld });

        return editorView(state(id), registry);
      });
    },
  };

  return service;
}

function titleProfession(title) {
  return title.replace(/^инструкция\s+по\s+охране\s+труда\s*(?:для\s+)?/iu, '').trim() || title;
}

export const instructionEditorService = createInstructionEditorService();
