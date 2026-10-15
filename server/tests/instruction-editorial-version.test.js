import assert from 'node:assert/strict';
import test from 'node:test';

import { createNewVersion } from '../src/services/instructionVersionService.js';

const SEO_DATE = '2025-01-03T10:00:00.000Z';
const CONTENT_DATE = '2025-02-04T11:00:00.000Z';
const FORGED_DATE = '2099-12-31T23:59:59.000Z';

function fixture() {
  const existing = {
    id: 'editorial-version-test',
    slug: 'editorial-version-slug',
    title: 'Инструкция по охране труда для электрика',
    profession: 'Электрик',
    professionKey: 'электрик',
    intro: 'Вступление к основному документу.',
    sections: [{ number: 1, heading: 'Требования', paragraphs: ['1.1. Проверить инструмент.'] }],
    webIntro: 'Вводная часть страницы.',
    explanationContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Пояснение к инструкции.' }] },
      ],
    },
    seoTitle: 'Инструкция электрика: текст и PDF',
    seoDescription: 'Полный документ и пояснение по его применению.',
    createdAt: '2024-12-01T00:00:00.000Z',
    publishedAt: '2024-12-02T00:00:00.000Z',
    updatedAt: '2025-03-05T00:00:00.000Z',
    revision: 7,
    version: '1.4',
    contentHash: 'old-content-hash',
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: SEO_DATE,
      contentUpdatedAt: CONTENT_DATE,
      seoAuthor: 'Николай Бойков',
      contentAuthor: 'Анна Иванова',
    },
  };
  const incoming = {
    title: existing.title,
    profession: existing.profession,
    professionKey: existing.professionKey,
    intro: existing.intro,
    sections: structuredClone(existing.sections),
    contentHash: existing.contentHash,
    seoReady: false,
    seoAuthor: 'Forged imported SEO author',
    contentAuthor: 'Forged imported document author',
    editorialMeta: {
      seoReady: false,
      seoUpdatedAt: FORGED_DATE,
      contentUpdatedAt: FORGED_DATE,
      seoAuthor: 'Forged nested SEO author',
      contentAuthor: 'Forged nested document author',
    },
  };

  return { existing, incoming };
}

function createVersion(existing, incoming) {
  return createNewVersion(existing, incoming, { hasPendingDraft: () => false });
}

function assertAdvanced(actual, previous) {
  assert.equal(typeof actual, 'string');
  assert.equal(new Date(actual).toISOString(), actual);
  assert.ok(Date.parse(actual) > Date.parse(previous));
  assert.notEqual(actual, FORGED_DATE);
}

test('importing the same document does not change editorial dates or accept incoming metadata', () => {
  const { existing, incoming } = fixture();
  const before = structuredClone(existing);
  const result = createVersion(existing, incoming);

  assert.deepEqual(result.editorialMeta, existing.editorialMeta);
  assert.deepEqual(existing, before);
});

test('a body-only imported update advances the content date and retains saved SEO readiness and date', () => {
  const { existing, incoming } = fixture();
  incoming.sections[0].paragraphs.push('1.2. Новый пункт импортированной инструкции.');
  incoming.contentHash = 'new-content-hash';
  const result = createVersion(existing, incoming);

  assert.equal(result.editorialMeta.seoReady, true);
  assert.equal(result.editorialMeta.seoUpdatedAt, SEO_DATE);
  assert.equal(result.editorialMeta.seoAuthor, existing.editorialMeta.seoAuthor);
  assert.equal(result.editorialMeta.contentAuthor, existing.editorialMeta.contentAuthor);
  assertAdvanced(result.editorialMeta.contentUpdatedAt, CONTENT_DATE);
});

test('an imported title change advances both editorial dates while retaining readiness', () => {
  const { existing, incoming } = fixture();
  incoming.title = 'Обновлённая инструкция по охране труда для электрика';
  const result = createVersion(existing, incoming);

  assert.equal(result.editorialMeta.seoReady, true);
  assert.equal(result.editorialMeta.seoAuthor, existing.editorialMeta.seoAuthor);
  assert.equal(result.editorialMeta.contentAuthor, existing.editorialMeta.contentAuthor);
  assertAdvanced(result.editorialMeta.seoUpdatedAt, SEO_DATE);
  assertAdvanced(result.editorialMeta.contentUpdatedAt, CONTENT_DATE);
});

test('import cannot mark a deliberately unready instruction ready through forged input fields', () => {
  const { existing, incoming } = fixture();
  existing.editorialMeta.seoReady = false;
  incoming.seoReady = true;
  incoming.editorialMeta.seoReady = true;
  incoming.sections[0].paragraphs.push('Новая документная строка.');
  const result = createVersion(existing, incoming);

  assert.equal(result.editorialMeta.seoReady, false);
  assert.equal(result.editorialMeta.seoUpdatedAt, SEO_DATE);
  assertAdvanced(result.editorialMeta.contentUpdatedAt, CONTENT_DATE);
});

test('unchanged legacy import does not invent missing historical editorial dates', () => {
  const { existing, incoming } = fixture();
  delete existing.editorialMeta;
  const result = createVersion(existing, incoming);

  assert.equal(result.editorialMeta.seoReady, true);
  assert.equal(result.editorialMeta.seoUpdatedAt, null);
  assert.equal(result.editorialMeta.contentUpdatedAt, null);
  assert.equal(result.editorialMeta.seoAuthor, null);
  assert.equal(result.editorialMeta.contentAuthor, null);
});
