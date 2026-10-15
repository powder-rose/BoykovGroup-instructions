import assert from 'node:assert/strict';
import test from 'node:test';

import { createNewVersion } from '../src/services/instructionVersionService.js';

function richText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function versionFixtures() {
  return {
    existing: {
      id: 'stable-instruction-id',
      slug: 'public-instruction-slug',
      slugAliases: ['previous-instruction-slug'],
      title: 'Старая инструкция',
      profession: 'Электрик',
      professionKey: 'электрик',
      intro: 'Прежнее вступление документа.',
      sections: [{ number: 1, heading: 'Прежний раздел', paragraphs: ['Старый пункт.'] }],
      instructionContent: richText('STALE_RICH_BODY: старый основной текст.'),
      webIntro: 'Вводный текст веб-страницы.',
      explanationContent: richText('Пояснение после инструкции.'),
      seoTitle: 'SEO-заголовок страницы',
      seoDescription: 'SEO-описание страницы.',
      status: 'published',
      version: '2.0',
      revision: 7,
      createdAt: '2026-01-01T00:00:00.000Z',
      publishedAt: '2026-01-02T00:00:00.000Z',
      contentHash: 'previous-content-hash',
    },
    incoming: {
      id: 'import-temporary-id',
      title: 'Обновлённая импортированная инструкция',
      profession: 'Электромонтёр',
      professionKey: 'электромонтер',
      intro: 'Новое вступление импортированного документа.',
      sections: [
        { number: 1, heading: 'Новые требования', paragraphs: ['1.1. Новый пункт документа.'] },
      ],
      contentHash: 'new-content-hash',
    },
  };
}

test('reimport replaces the stale rich body with incoming legacy content and retains web-only fields', () => {
  const { existing, incoming } = versionFixtures();
  const previous = structuredClone(existing);
  const imported = structuredClone(incoming);
  const updated = createNewVersion(existing, incoming, { hasPendingDraft: () => false });
  const richBody = JSON.stringify(updated.instructionContent);

  assert.equal(updated.id, existing.id);
  assert.equal(updated.title, incoming.title);
  assert.equal(updated.professionKey, incoming.professionKey);
  assert.equal(updated.intro, incoming.intro);
  assert.deepEqual(updated.sections, incoming.sections);
  assert.ok(richBody.includes(incoming.intro));
  assert.ok(richBody.includes(incoming.sections[0].heading));
  assert.ok(richBody.includes(incoming.sections[0].paragraphs[0]));
  assert.ok(!richBody.includes('STALE_RICH_BODY'));

  for (const field of [
    'slug',
    'slugAliases',
    'webIntro',
    'explanationContent',
    'seoTitle',
    'seoDescription',
    'publishedAt',
    'createdAt',
    'status',
  ]) {
    assert.deepEqual(updated[field], existing[field], `Import must retain ${field}`);
  }

  assert.equal(updated.version, '2.1');
  assert.equal(updated.revision, 8);
  assert.equal(updated.contentHash, incoming.contentHash);
  assert.deepEqual(existing, previous);
  assert.deepEqual(incoming, imported);
});

test('reimport refuses to overwrite an instruction that has a pending editorial draft', () => {
  const { existing, incoming } = versionFixtures();
  const previous = structuredClone(existing);
  const imported = structuredClone(incoming);

  assert.throws(
    () =>
      createNewVersion(existing, incoming, {
        hasPendingDraft: instruction => {
          assert.equal(instruction.id, existing.id);
          return true;
        },
      }),
    {
      status: 409,
      code: 'INSTRUCTION_DRAFT_CONFLICT',
    },
  );
  assert.deepEqual(existing, previous);
  assert.deepEqual(incoming, imported);
});
