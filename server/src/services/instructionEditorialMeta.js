import { isDeepStrictEqual } from 'node:util';

import {
  getInstructionDocument,
  getInstructionSeo,
  richTextToPlainText,
} from '../shared/instructionDocument.js';
import { normalizeRichTextContent } from './richTextContent.js';

const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] };

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

function descriptionWords(value) {
  return normalizedText(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function knownDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function knownAuthor(value) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function detectedReadiness(instruction) {
  if (!normalizedText(instruction.webIntro)) return false;
  if (!richTextToPlainText(instruction.explanationContent).trim()) return false;

  const explicitDescription = descriptionWords(instruction.seoDescription);
  const fallback = getInstructionSeo({ ...instruction, seoDescription: undefined }).description;
  const fallbackSuffix = descriptionWords(
    'Полный текст инструкции и скачивание PDF после регистрации',
  );

  return Boolean(
    explicitDescription &&
    explicitDescription !== descriptionWords(fallback) &&
    !explicitDescription.endsWith(fallbackSuffix),
  );
}

// Unknown dates remain unknown: updatedAt also changes on publication and draft bookkeeping.
export function getInstructionEditorialMeta(instruction = {}) {
  const stored = instruction.editorialMeta;
  const hasSavedReadiness = typeof stored?.seoReady === 'boolean';
  const detected = !hasSavedReadiness && detectedReadiness(instruction);

  return {
    seoReady: hasSavedReadiness ? stored.seoReady : detected,
    seoReadySource: hasSavedReadiness ? 'saved' : detected ? 'detected' : 'none',
    seoUpdatedAt: knownDate(stored?.seoUpdatedAt),
    contentUpdatedAt: knownDate(stored?.contentUpdatedAt),
    seoAuthor: knownAuthor(stored?.seoAuthor),
    contentAuthor: knownAuthor(stored?.contentAuthor),
  };
}

function canonicalDocument(document) {
  const normalized = normalizeRichTextContent(document || EMPTY_DOCUMENT);

  function canonicalNode(node) {
    const result = { ...node };
    if (result.marks) {
      result.marks = [...result.marks].sort((first, second) =>
        first.type.localeCompare(second.type),
      );
    }
    if (result.content) {
      const content = [];
      for (const rawChild of result.content) {
        const child = canonicalNode(rawChild);
        const previous = content.at(-1);
        if (
          child.type === 'text' &&
          previous?.type === 'text' &&
          isDeepStrictEqual(child.marks, previous.marks)
        ) {
          previous.text += child.text;
        } else {
          content.push(child);
        }
      }
      result.content = content;
    }
    return result;
  }

  // An empty editor paragraph and an absent optional document have the same meaning.
  if (
    !normalized.content.length ||
    normalized.content.every(node => node.type === 'paragraph' && !node.content.length)
  ) {
    return EMPTY_DOCUMENT;
  }
  return canonicalNode(normalized);
}

function seoFields(instruction) {
  const seo = getInstructionSeo(instruction);
  return {
    title: normalizedText(instruction.title),
    slug: String(instruction.slug || instruction.id || '').trim(),
    webIntro: normalizedText(instruction.webIntro),
    explanationContent: canonicalDocument(instruction.explanationContent),
    seoTitle: normalizedText(seo.title),
    seoDescription: normalizedText(seo.description),
  };
}

function contentFields(instruction) {
  return {
    title: normalizedText(instruction.title),
    instructionContent: canonicalDocument(getInstructionDocument(instruction)),
  };
}

// Callers choose readiness explicitly only for the admin checkbox or a history rollback.
// Metadata on `next` is deliberately ignored, including timestamps supplied by an import.
export function updateInstructionEditorialMeta(
  previous,
  next,
  { seoReady, seoAuthor, contentAuthor, now = new Date().toISOString() } = {},
) {
  const current = getInstructionEditorialMeta(previous || {});
  const ready = typeof seoReady === 'boolean' ? seoReady : previous ? current.seoReady : false;
  const seoChanged =
    !previous ||
    ready !== current.seoReady ||
    !isDeepStrictEqual(seoFields(previous), seoFields(next));
  const contentChanged =
    !previous || !isDeepStrictEqual(contentFields(previous), contentFields(next));

  return {
    seoReady: ready,
    seoUpdatedAt: seoChanged ? now : current.seoUpdatedAt,
    contentUpdatedAt: contentChanged ? now : current.contentUpdatedAt,
    seoAuthor: seoAuthor === undefined ? current.seoAuthor : knownAuthor(seoAuthor),
    contentAuthor: contentAuthor === undefined ? current.contentAuthor : knownAuthor(contentAuthor),
  };
}
