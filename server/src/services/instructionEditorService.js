import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { slugify } from '../utils/slug.js';
import {
  getInstructionDocument,
  getInstructionSeo,
  instructionDocumentToLegacy,
  richTextToPlainText,
} from '../shared/instructionDocument.js';
import { instructionsRepository } from './instructionsRepository.js';
import { getInstructionTaxonomyDisplay } from './instructionTaxonomyDisplayService.js';
import { applyInstructionTaxonomyEditorPatch } from './instructionTaxonomyEditor.js';
import { saveInstructionSnapshot } from './instructionHistoryService.js';
import { normalizeProfessionKey } from './professionNormalizer.js';
import { createInstructionHash } from './instructionHashService.js';
import { rankInstructionsByQuery } from './searchService.js';
import { normalizeRichTextContent } from './richTextContent.js';
import { InstructionEditorError } from './instructionEditorError.js';
import {
  getInstructionEditorialMeta,
  updateInstructionEditorialMeta,
} from './instructionEditorialMeta.js';

const DEFAULT_DRAFTS = fileURLToPath(new URL('../data/instruction-drafts/', import.meta.url));
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
  { limit = 4, repository = instructionsRepository } = {},
) {
  const others = repository.getAll().filter(item => item.id !== instruction.id);
  const query = instruction.profession || instruction.title;

  if (!String(query || '').trim()) return [];

  return rankInstructionsByQuery(others, query, { sort: 'relevance', allowPartialMatch: true })
    .slice(0, Math.max(0, Math.min(limit, 12)))
    .map(instructionSummary);
}

export function createInstructionEditorService({
  repository = instructionsRepository,
  draftsDirectory = DEFAULT_DRAFTS,
  saveSnapshot = saveInstructionSnapshot,
} = {}) {
  function draftPath(id) {
    return path.join(
      draftsDirectory,
      `${Buffer.from(String(id), 'utf8').toString('base64url')}.json`,
    );
  }

  function readDraftFile(filePath) {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (
        !value?.id ||
        !Number.isInteger(value.revision) ||
        value.revision < 1 ||
        value.status !== 'draft'
      ) {
        throw new Error('Invalid instruction draft');
      }

      return value;
    } catch (cause) {
      if (cause.code === 'ENOENT') return null;

      throw new InstructionEditorError('Не удалось прочитать черновик инструкции', {
        status: 500,
        code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
        cause,
      });
    }
  }

  function readDraft(id) {
    return readDraftFile(draftPath(id));
  }

  function allDrafts() {
    let files;

    try {
      files = fs.readdirSync(draftsDirectory).filter(file => file.endsWith('.json'));
    } catch (cause) {
      if (cause.code === 'ENOENT') return [];

      throw new InstructionEditorError('Не удалось прочитать черновики', {
        status: 500,
        code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
        cause,
      });
    }

    return files.map(file => readDraftFile(path.join(draftsDirectory, file))).filter(Boolean);
  }

  function writeDraft(instruction) {
    const target = draftPath(instruction.id);
    const temporary = path.join(draftsDirectory, `.${path.basename(target)}.${randomUUID()}.tmp`);

    try {
      fs.mkdirSync(draftsDirectory, { recursive: true });
      fs.writeFileSync(temporary, `${JSON.stringify(instruction, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flush: true,
      });
      fs.renameSync(temporary, target);
    } catch (cause) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch (cleanupError) {
        console.error('[Instructions] Failed to clean unfinished draft:', cleanupError);
      }

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

  function editorView({ published, draft, editable, revision }) {
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
        taxonomyDisplay: getInstructionTaxonomyDisplay(editable),
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
    list() {
      const ids = new Set([...repository.getAll(), ...allDrafts()].map(item => item.id));

      return [...ids]
        .map(id => {
          const view = service.get(id);

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
      return editorView(state(id));
    },

    save(id, input) {
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
      );

      instruction.contentHash = createInstructionHash(instruction);
      instruction.editorialMeta = updateInstructionEditorialMeta(previous?.editable, instruction, {
        seoReady: input.seoReady,
        seoAuthor: input.seoAuthor,
        contentAuthor: input.contentAuthor,
        now,
      });

      if (values.status === 'draft') {
        writeDraft(instruction);
      } else {
        const lastPublication =
          published || (previous?.editable.publishedAt ? previous.editable : null);

        instruction.version = lastPublication
          ? (Number(lastPublication.version || '1.0') + 0.1).toFixed(1)
          : '1.0';
        instruction.publishedAt = lastPublication?.publishedAt || lastPublication?.createdAt || now;

        if (published) saveSnapshot(published);

        repository.save(instruction);

        // A leftover older draft is ignored by state() if cleanup itself fails.
        try {
          removeDraft(stableId);
        } catch (error) {
          console.error(
            '[Instructions] Published successfully; failed to remove old draft:',
            error,
          );
        }
      }

      return service.get(stableId);
    },

    remove(id, { revision } = {}) {
      const current = state(id);

      assertRevision(current.revision, revision);
      if (current.published) repository.remove(id);

      try {
        removeDraft(id);
      } catch (error) {
        if (current.published) repository.save(current.published);
        throw error;
      }
    },

    discardDraft(id, { revision } = {}) {
      const current = state(id);

      assertRevision(current.revision, revision);

      if (current.published && current.draft) {
        repository.save({ ...current.published, revision: current.revision + 1 });
      }

      removeDraft(id);

      return current.published ? service.get(id) : null;
    },

    unpublish(id, { revision } = {}) {
      const current = state(id);

      assertRevision(current.revision, revision);

      if (!current.published) return service.get(id);

      const draft = {
        ...current.editable,
        status: 'draft',
        publishedAt: current.published.publishedAt || current.published.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      };

      writeDraft(draft);
      repository.remove(id);

      return service.get(id);
    },
  };

  return service;
}

function titleProfession(title) {
  return title.replace(/^инструкция\s+по\s+охране\s+труда\s*(?:для\s+)?/iu, '').trim() || title;
}

export const instructionEditorService = createInstructionEditorService();
