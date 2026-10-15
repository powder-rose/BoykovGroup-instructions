import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInstructionEditorialMeta,
  updateInstructionEditorialMeta,
} from '../src/services/instructionEditorialMeta.js';
import { getInstructionDocument, getInstructionSeo } from '../src/shared/instructionDocument.js';

const richText = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const oldSeoDate = '2020-01-01T00:00:00.000Z';
const oldContentDate = '2021-01-01T00:00:00.000Z';
const now = '2026-10-15T12:00:00.000Z';
const unknownAuthors = { seoAuthor: null, contentAuthor: null };

function instruction(overrides = {}) {
  return {
    id: 'legacy_Nano-ID',
    title: 'Инструкция электромонтёра',
    intro: 'Полный текст документа',
    sections: [],
    webIntro: 'Как применять инструкцию на предприятии.',
    explanationContent: richText('Порядок утверждения и применения документа.'),
    seoDescription: 'Инструкция электромонтёра: требования перед работой и порядок утверждения.',
    updatedAt: now,
    ...overrides,
  };
}

test('legacy readiness requires every web field and excludes current or historic fallback descriptions', () => {
  const value = instruction();
  assert.deepEqual(getInstructionEditorialMeta(value), {
    seoReady: true,
    seoReadySource: 'detected',
    seoUpdatedAt: null,
    contentUpdatedAt: null,
    ...unknownAuthors,
  });
  const fallback = getInstructionSeo({ ...value, seoDescription: undefined }).description;
  for (const patch of [
    { webIntro: ' \n ' },
    { explanationContent: { type: 'doc', content: [{ type: 'paragraph' }] } },
    { seoDescription: undefined },
    { seoDescription: fallback },
    { seoDescription: fallback.toUpperCase().replaceAll(' ', '  ').replaceAll('.', '!') },
    {
      seoDescription:
        'Старое название документа. Полный текст инструкции и скачивание PDF после регистрации.',
    },
  ]) {
    assert.deepEqual(getInstructionEditorialMeta({ ...value, ...patch }), {
      seoReady: false,
      seoReadySource: 'none',
      seoUpdatedAt: null,
      contentUpdatedAt: null,
      ...unknownAuthors,
    });
  }
});

test('saved true and false override inference, and unknown dates never borrow updatedAt', () => {
  for (const seoReady of [true, false]) {
    const value = instruction({
      editorialMeta: { seoReady, seoUpdatedAt: 'bad date', contentUpdatedAt: null },
    });
    assert.deepEqual(getInstructionEditorialMeta(value), {
      seoReady,
      seoReadySource: 'saved',
      seoUpdatedAt: null,
      contentUpdatedAt: null,
      ...unknownAuthors,
    });
  }
});

test('legacy default prefilling and editor normalization preserve unknown dates', () => {
  const previous = instruction({
    seoDescription: undefined,
    explanationContent: undefined,
    webIntro: undefined,
  });
  const next = {
    ...previous,
    slug: previous.id,
    webIntro: '',
    instructionContent: getInstructionDocument(previous),
    explanationContent: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    seoTitle: getInstructionSeo(previous).title,
    seoDescription: getInstructionSeo(previous).description,
  };
  assert.deepEqual(updateInstructionEditorialMeta(previous, next, { now }), {
    seoReady: false,
    seoUpdatedAt: null,
    contentUpdatedAt: null,
    ...unknownAuthors,
  });
});

test('canonical rich documents ignore default attributes and adjacent text segmentation', () => {
  const previous = instruction({
    instructionContent: richText('Полный текст'),
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: oldSeoDate,
      contentUpdatedAt: oldContentDate,
      ...unknownAuthors,
    },
  });
  const next = {
    ...previous,
    instructionContent: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [
            { type: 'text', text: 'Полный ', marks: [] },
            { type: 'text', text: 'текст' },
          ],
        },
      ],
    },
  };
  assert.deepEqual(updateInstructionEditorialMeta(previous, next, { now }), previous.editorialMeta);
});

test('readiness toggle is an SEO change only and incoming metadata never controls either clock', () => {
  const previous = instruction({
    editorialMeta: {
      seoReady: false,
      seoUpdatedAt: oldSeoDate,
      contentUpdatedAt: oldContentDate,
      ...unknownAuthors,
    },
  });
  const next = {
    ...previous,
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: '2099-01-01T00:00:00.000Z',
      contentUpdatedAt: '2099-01-01T00:00:00.000Z',
    },
  };
  assert.deepEqual(updateInstructionEditorialMeta(previous, next, { now }), previous.editorialMeta);
  assert.deepEqual(updateInstructionEditorialMeta(previous, next, { seoReady: true, now }), {
    seoReady: true,
    seoUpdatedAt: now,
    contentUpdatedAt: oldContentDate,
    ...unknownAuthors,
  });
});

test('author credits are trimmed, independently assigned and never presented as edit timestamps', () => {
  const previous = instruction({
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: oldSeoDate,
      contentUpdatedAt: oldContentDate,
      seoAuthor: 'Первый SEO-автор',
      contentAuthor: 'Автор инструкции',
    },
  });
  assert.deepEqual(
    updateInstructionEditorialMeta(previous, previous, {
      seoAuthor: '  Новый SEO-автор  ',
      contentAuthor: '',
      now,
    }),
    {
      seoReady: true,
      seoUpdatedAt: oldSeoDate,
      contentUpdatedAt: oldContentDate,
      seoAuthor: 'Новый SEO-автор',
      contentAuthor: null,
    },
  );
});
