import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInstructionDocument,
  getInstructionOutline,
  getInstructionPublicPath,
  getInstructionSeo,
  instructionDocumentToLegacy,
  richTextToPlainText,
} from '../src/shared/instructionDocument.js';

test('legacy instruction conversion preserves preamble, sections, hard breaks and appendix', () => {
  const legacy = {
    id: 'original-id',
    intro: 'Утверждено\nВводная часть',
    sections: [
      {
        number: 1,
        heading: 'Общие требования',
        paragraphs: ['1.1. Первый пункт.', '1.2. Второй пункт.'],
      },
      {
        number: 2,
        heading: '2. Приложение',
        paragraphs: [{ text: 'Текст приложения без сокращений.' }],
      },
    ],
  };
  const document = getInstructionDocument(legacy);
  assert.equal(
    richTextToPlainText(document),
    'Утверждено\nВводная часть\n1. Общие требования\n1.1. Первый пункт.\n1.2. Второй пункт.\n2. Приложение\nТекст приложения без сокращений.',
  );
  assert.deepEqual(instructionDocumentToLegacy(document), {
    intro: legacy.intro,
    sections: [
      legacy.sections[0],
      { number: 2, heading: 'Приложение', paragraphs: ['Текст приложения без сокращений.'] },
    ],
  });
  assert.equal(legacy.sections[1].heading, '2. Приложение');
});

test('rich instruction content remains authoritative and outline anchors are unique for repeated headings', () => {
  const heading = (text, level = 2) => ({
    type: 'heading',
    attrs: { level },
    content: text ? [{ type: 'text', text }] : [],
  });
  const document = {
    type: 'doc',
    content: [
      heading('Требования'),
      heading(''),
      { type: 'blockquote', content: [heading('Требования', 3)] },
    ],
  };
  assert.equal(
    getInstructionDocument({ instructionContent: document, intro: 'Старая версия' }),
    document,
  );
  assert.deepEqual(getInstructionOutline(document), [
    { id: 'instruction-section-1', label: 'Требования', level: 2 },
    { id: 'instruction-section-3', label: 'Требования', level: 3 },
  ]);
});

test('public URL and SEO use editorial fields with legacy fallbacks', () => {
  const legacy = { id: 'original-id', title: 'Инструкция для электромонтёра' };
  assert.equal(getInstructionPublicPath(legacy), '/instrukciya-po-ohrane-truda/original-id');
  assert.equal(
    getInstructionPublicPath({ ...legacy, slug: 'elektromonter' }),
    '/instrukciya-po-ohrane-truda/elektromonter',
  );
  assert.deepEqual(
    getInstructionSeo({
      ...legacy,
      seoTitle: 'Скачать инструкцию',
      seoDescription: 'Описание документа',
    }),
    {
      title: 'Скачать инструкцию',
      description: 'Описание документа',
    },
  );
  assert.match(getInstructionSeo(legacy).title, /электромонтёра/);
});

test('legacy projection keeps authored section and ordered-list numbering', () => {
  const text = value => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
  const document = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '4. Порядок действий' }],
      },
      {
        type: 'orderedList',
        attrs: { start: 5 },
        content: [
          { type: 'listItem', content: [text('Первое действие')] },
          { type: 'listItem', content: [text('Второе действие')] },
        ],
      },
    ],
  };
  assert.deepEqual(instructionDocumentToLegacy(document), {
    intro: '',
    sections: [
      {
        number: 4,
        heading: 'Порядок действий',
        paragraphs: ['5. Первое действие\n6. Второе действие'],
      },
    ],
  });
});
