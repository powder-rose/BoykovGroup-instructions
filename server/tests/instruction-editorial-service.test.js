import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const SEO_DATE = '2025-01-03T10:00:00.000Z';
const CONTENT_DATE = '2025-02-04T11:00:00.000Z';
const FORGED_DATE = '2099-12-31T23:59:59.000Z';

function richText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function input(overrides = {}) {
  return {
    title: 'Инструкция по охране труда для электромонтёра',
    slug: 'elektromonter-editorial-test',
    webIntro: 'Полный текст инструкции и возможность скачать документ.',
    instructionContent: richText('1.1. Проверить инструмент перед началом работы.'),
    explanationContent: richText('Пояснение по применению и утверждению инструкции.'),
    seoTitle: 'Инструкция электромонтёра: полный текст и PDF',
    seoDescription:
      'Требования безопасности для электромонтёра, готовый документ и его применение.',
    status: 'published',
    ...overrides,
  };
}

function published(overrides = {}) {
  return {
    ...input(),
    id: 'editorial-test-instruction',
    createdAt: '2024-12-01T00:00:00.000Z',
    publishedAt: '2024-12-02T00:00:00.000Z',
    updatedAt: '2025-03-05T00:00:00.000Z',
    revision: 6,
    version: '1.4',
    editorialMeta: {
      seoReady: false,
      seoUpdatedAt: SEO_DATE,
      contentUpdatedAt: CONTENT_DATE,
      seoAuthor: null,
      contentAuthor: null,
    },
    ...overrides,
  };
}

function fixture(t, record) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-editorial-service-'));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const service = createInstructionEditorService({
    repository,
    draftsDirectory: path.join(directory, 'drafts'),
    saveSnapshot: () => {},
  });

  if (record) repository.save(record);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return { repository, service };
}

function assertAdvanced(actual, previous) {
  assert.equal(typeof actual, 'string');
  assert.equal(new Date(actual).toISOString(), actual);
  assert.ok(Date.parse(actual) > Date.parse(previous));
  assert.notEqual(actual, FORGED_DATE);
}

function storedMeta(meta) {
  return {
    seoReady: meta.seoReady,
    seoUpdatedAt: meta.seoUpdatedAt,
    contentUpdatedAt: meta.contentUpdatedAt,
    seoAuthor: meta.seoAuthor,
    contentAuthor: meta.contentAuthor,
  };
}

test('new instructions are not automatically marked SEO-ready and reject forged metadata ownership', t => {
  const { repository, service } = fixture(t);
  const result = service.save(
    null,
    input({
      editorialMeta: {
        seoReady: true,
        seoUpdatedAt: FORGED_DATE,
        contentUpdatedAt: FORGED_DATE,
        seoAuthor: 'Forged nested SEO author',
        contentAuthor: 'Forged nested document author',
      },
      seoUpdatedAt: FORGED_DATE,
      contentUpdatedAt: FORGED_DATE,
    }),
  );
  const meta = result.instruction.editorialMeta;

  assert.equal(meta.seoReady, false);
  assert.equal(meta.seoReadySource, 'saved');
  assert.equal(meta.seoAuthor, null);
  assert.equal(meta.contentAuthor, null);
  assertAdvanced(meta.seoUpdatedAt, SEO_DATE);
  assertAdvanced(meta.contentUpdatedAt, CONTENT_DATE);
  assert.equal(repository.getById(result.instruction.id).editorialMeta.seoReady, false);
});

test('admin get and list expose saved editorial metadata and the published metadata separately', t => {
  const record = published();
  const { service } = fixture(t, record);
  const result = service.get(record.id);
  const summary = service.list()[0];

  assert.deepEqual(storedMeta(result.instruction.editorialMeta), record.editorialMeta);
  assert.equal(result.instruction.editorialMeta.seoReadySource, 'saved');
  assert.deepEqual(summary.editorialMeta, result.instruction.editorialMeta);
  assert.deepEqual(result.publishedEditorialMeta, result.instruction.editorialMeta);
  assert.deepEqual(summary.publishedEditorialMeta, result.publishedEditorialMeta);
});

test('each actual SEO-only edit advances only the SEO date and preserves the document date', t => {
  const changes = [
    { slug: 'changed-public-address' },
    { webIntro: 'Новое вступление только для страницы.' },
    { explanationContent: richText('Новое пояснение после документа.') },
    { seoTitle: 'Новый поисковый заголовок' },
    { seoDescription: 'Новое описание для результатов поиска.' },
    { seoReady: true },
  ];

  for (const change of changes) {
    const record = published();
    const { repository, service } = fixture(t, record);
    const result = service.save(record.id, { ...service.get(record.id).instruction, ...change });
    const meta = result.instruction.editorialMeta;

    assertAdvanced(meta.seoUpdatedAt, SEO_DATE);
    assert.equal(meta.contentUpdatedAt, CONTENT_DATE);
    assert.equal(meta.seoReady, change.seoReady ?? false);
    assert.deepEqual(repository.getById(record.id).editorialMeta, storedMeta(meta));
  }
});

test('a title edit advances both dates because it changes the page and the downloadable document', t => {
  const record = published();
  const { service } = fixture(t, record);
  const result = service.save(record.id, {
    ...service.get(record.id).instruction,
    title: 'Новая редакция инструкции электромонтёра',
  });

  assertAdvanced(result.instruction.editorialMeta.seoUpdatedAt, SEO_DATE);
  assertAdvanced(result.instruction.editorialMeta.contentUpdatedAt, CONTENT_DATE);
});

test('an instruction-body edit advances only the content date without resetting saved SEO readiness', t => {
  const record = published({
    editorialMeta: { seoReady: true, seoUpdatedAt: SEO_DATE, contentUpdatedAt: CONTENT_DATE },
  });
  const { service } = fixture(t, record);
  const result = service.save(record.id, {
    ...service.get(record.id).instruction,
    instructionContent: richText('1.1. Новое требование непосредственно в инструкции.'),
  });
  const meta = result.instruction.editorialMeta;

  assert.equal(meta.seoReady, true);
  assert.equal(meta.seoUpdatedAt, SEO_DATE);
  assertAdvanced(meta.contentUpdatedAt, CONTENT_DATE);
});

test('saving unchanged data and an unchanged readiness checkbox preserves both dates', t => {
  const record = published();
  const { service } = fixture(t, record);
  const result = service.save(record.id, {
    ...service.get(record.id).instruction,
    seoReady: false,
    seoUpdatedAt: FORGED_DATE,
    contentUpdatedAt: FORGED_DATE,
    editorialMeta: { seoReady: true, seoUpdatedAt: FORGED_DATE, contentUpdatedAt: FORGED_DATE },
  });

  assert.deepEqual(storedMeta(result.instruction.editorialMeta), record.editorialMeta);
});

test('clearing an explicitly saved readiness flag advances only its SEO date', t => {
  const record = published({
    editorialMeta: { seoReady: true, seoUpdatedAt: SEO_DATE, contentUpdatedAt: CONTENT_DATE },
  });
  const { service } = fixture(t, record);
  const result = service.save(record.id, {
    ...service.get(record.id).instruction,
    seoReady: false,
  });

  assert.equal(result.instruction.editorialMeta.seoReady, false);
  assert.equal(result.instruction.editorialMeta.contentUpdatedAt, CONTENT_DATE);
  assertAdvanced(result.instruction.editorialMeta.seoUpdatedAt, SEO_DATE);
});

test('invalid readiness values are rejected without changing stored content or metadata', t => {
  const record = published();
  const { repository, service } = fixture(t, record);

  for (const seoReady of ['true', 1, null, {}, []]) {
    assert.throws(
      () => service.save(record.id, { ...service.get(record.id).instruction, seoReady }),
      { status: 400 },
    );
  }

  assert.deepEqual(repository.getById(record.id), record);
});

test('legacy default fields filled by the editor are a no-op with unknown historical dates', t => {
  const legacy = {
    id: 'legacy_Editorial-X9',
    title: 'Инструкция по охране труда для электрика',
    intro: 'Документное вступление.',
    sections: [{ number: 1, heading: 'Требования', paragraphs: ['1.1. Проверить рабочее место.'] }],
    createdAt: '2024-12-01T00:00:00.000Z',
    updatedAt: '2025-03-05T00:00:00.000Z',
  };
  const { service } = fixture(t, legacy);
  const before = service.get(legacy.id).instruction;

  assert.equal(before.editorialMeta.seoReadySource, 'none');

  const result = service.save(legacy.id, { ...before, status: 'published' });

  assert.deepEqual(storedMeta(result.instruction.editorialMeta), {
    seoReady: false,
    seoUpdatedAt: null,
    contentUpdatedAt: null,
    seoAuthor: null,
    contentAuthor: null,
  });
});

test('legacy readiness detection requires web introduction, explanatory text and a custom description', t => {
  const full = published({ editorialMeta: undefined });
  const fallback = `${full.title}. Полный текст инструкции и скачивание PDF после регистрации.`;
  const cases = [
    [full, true, 'detected'],
    [{ ...full, webIntro: '  ' }, false, 'none'],
    [
      { ...full, explanationContent: { type: 'doc', content: [{ type: 'paragraph' }] } },
      false,
      'none',
    ],
    [{ ...full, seoDescription: undefined }, false, 'none'],
    [{ ...full, seoDescription: fallback }, false, 'none'],
    [
      {
        ...full,
        seoDescription:
          'Прежний заголовок инструкции. Полный текст инструкции и скачивание PDF после регистрации.',
      },
      false,
      'none',
    ],
    [
      { ...full, editorialMeta: { seoReady: false, seoUpdatedAt: null, contentUpdatedAt: null } },
      false,
      'saved',
    ],
  ];

  for (const [record, ready, source] of cases) {
    const { repository, service } = fixture(t, record);
    const file = path.join(repository.dir, `${record.id}.json`);
    const beforeRead = fs.readFileSync(file, 'utf8');
    const result = service.get(record.id);

    assert.equal(result.instruction.editorialMeta.seoReady, ready);
    assert.equal(result.instruction.editorialMeta.seoReadySource, source);
    assert.equal(result.instruction.editorialMeta.seoUpdatedAt, null);
    assert.equal(result.instruction.editorialMeta.contentUpdatedAt, null);
    assert.equal(fs.readFileSync(file, 'utf8'), beforeRead);
  }
});

test('ordinary saving a detected legacy-ready instruction does not invent historical timestamps', t => {
  const record = published({ editorialMeta: undefined });
  const { service } = fixture(t, record);
  const before = service.get(record.id).instruction;

  assert.equal(before.editorialMeta.seoReadySource, 'detected');

  const result = service.save(record.id, before);

  assert.equal(result.instruction.editorialMeta.seoReadySource, 'saved');
  assert.deepEqual(storedMeta(result.instruction.editorialMeta), {
    seoReady: true,
    seoUpdatedAt: null,
    contentUpdatedAt: null,
    seoAuthor: null,
    contentAuthor: null,
  });
});

test('draft edits have their own editorial metadata and publication does not stamp unchanged content again', t => {
  const record = published();
  const { repository, service } = fixture(t, record);
  const diskBefore = fs.readFileSync(path.join(repository.dir, `${record.id}.json`), 'utf8');
  const draft = service.save(record.id, {
    ...service.get(record.id).instruction,
    status: 'draft',
    webIntro: 'Черновая новая вводная часть страницы.',
    seoReady: true,
    seoAuthor: 'Автор SEO черновика',
    contentAuthor: 'Автор инструкции в черновике',
  });

  assert.equal(draft.instruction.editorialMeta.seoReady, true);
  assert.equal(draft.instruction.editorialMeta.seoAuthor, 'Автор SEO черновика');
  assert.equal(draft.instruction.editorialMeta.contentAuthor, 'Автор инструкции в черновике');
  assertAdvanced(draft.instruction.editorialMeta.seoUpdatedAt, SEO_DATE);
  assert.equal(draft.instruction.editorialMeta.contentUpdatedAt, CONTENT_DATE);
  assert.deepEqual(storedMeta(draft.publishedEditorialMeta), record.editorialMeta);
  assert.deepEqual(service.list()[0].editorialMeta, draft.instruction.editorialMeta);
  assert.deepEqual(service.list()[0].publishedEditorialMeta, draft.publishedEditorialMeta);
  assert.equal(fs.readFileSync(path.join(repository.dir, `${record.id}.json`), 'utf8'), diskBefore);

  const result = service.save(record.id, { ...draft.instruction, status: 'published' });

  assert.deepEqual(result.instruction.editorialMeta, draft.instruction.editorialMeta);
  assert.deepEqual(
    storedMeta(result.publishedEditorialMeta),
    storedMeta(draft.instruction.editorialMeta),
  );
  assert.deepEqual(
    repository.getById(record.id).editorialMeta,
    storedMeta(draft.instruction.editorialMeta),
  );
});

test('discarding a draft restores published editorial metadata without altering its dates', t => {
  const record = published();
  const { repository, service } = fixture(t, record);
  const draft = service.save(record.id, {
    ...service.get(record.id).instruction,
    status: 'draft',
    instructionContent: richText('Изменённый черновой текст.'),
    seoReady: true,
    seoAuthor: 'Неопубликованный автор SEO',
    contentAuthor: 'Неопубликованный автор инструкции',
  });

  service.discardDraft(record.id, { revision: draft.instruction.revision });

  const result = service.get(record.id);

  assert.equal(result.hasDraft, false);
  assert.deepEqual(storedMeta(result.instruction.editorialMeta), record.editorialMeta);
  assert.deepEqual(repository.getById(record.id).editorialMeta, record.editorialMeta);
});

test('unpublish and republish preserve editorial dates when no page or document content changes', t => {
  const record = published();
  const { service } = fixture(t, record);
  const draft = service.unpublish(record.id, { revision: record.revision });

  assert.deepEqual(storedMeta(draft.instruction.editorialMeta), record.editorialMeta);
  assert.equal(draft.publishedEditorialMeta, null);

  const result = service.save(record.id, { ...draft.instruction, status: 'published' });

  assert.deepEqual(storedMeta(result.instruction.editorialMeta), record.editorialMeta);
});

test('author credits are trimmed and persisted without advancing SEO or document dates', t => {
  const record = published();
  const { repository, service } = fixture(t, record);
  const result = service.save(record.id, {
    ...service.get(record.id).instruction,
    seoAuthor: '  Николай Бойков  ',
    contentAuthor: '  Анна Иванова  ',
  });
  const expected = {
    ...record.editorialMeta,
    seoAuthor: 'Николай Бойков',
    contentAuthor: 'Анна Иванова',
  };

  assert.deepEqual(storedMeta(result.instruction.editorialMeta), expected);
  assert.deepEqual(repository.getById(record.id).editorialMeta, expected);
  assert.deepEqual(storedMeta(service.list()[0].editorialMeta), expected);
  assert.deepEqual(storedMeta(result.publishedEditorialMeta), expected);
});

test('an explicit empty author clears that credit and an omitted author retains the other credit', t => {
  const record = published();
  record.editorialMeta.seoAuthor = 'Николай Бойков';
  record.editorialMeta.contentAuthor = 'Анна Иванова';
  const { service } = fixture(t, record);
  const first = service.save(record.id, {
    ...service.get(record.id).instruction,
    seoAuthor: '',
  });

  assert.equal(first.instruction.editorialMeta.seoAuthor, null);
  assert.equal(first.instruction.editorialMeta.contentAuthor, 'Анна Иванова');
  assert.equal(first.instruction.editorialMeta.seoUpdatedAt, SEO_DATE);
  assert.equal(first.instruction.editorialMeta.contentUpdatedAt, CONTENT_DATE);

  const second = service.save(record.id, { ...first.instruction, contentAuthor: '   ' });

  assert.equal(second.instruction.editorialMeta.seoAuthor, null);
  assert.equal(second.instruction.editorialMeta.contentAuthor, null);
  assert.equal(second.instruction.editorialMeta.seoUpdatedAt, SEO_DATE);
  assert.equal(second.instruction.editorialMeta.contentUpdatedAt, CONTENT_DATE);
});

test('author credits accept 120 characters and reject longer, null and non-string inputs atomically', t => {
  const record = published();
  const { repository, service } = fixture(t, record);
  const allowed = 'А'.repeat(120);
  const saved = service.save(record.id, {
    ...service.get(record.id).instruction,
    seoAuthor: `  ${allowed}  `,
    contentAuthor: `  ${allowed}  `,
  });
  const before = structuredClone(repository.getById(record.id));

  assert.equal(saved.instruction.editorialMeta.seoAuthor, allowed);
  assert.equal(saved.instruction.editorialMeta.contentAuthor, allowed);

  for (const field of ['seoAuthor', 'contentAuthor']) {
    for (const value of ['А'.repeat(121), null, true, 12, {}, []]) {
      assert.throws(
        () =>
          service.save(record.id, {
            ...service.get(record.id).instruction,
            [field]: value,
          }),
        { status: 400 },
      );
      assert.deepEqual(repository.getById(record.id), before);
    }
  }
});

test('adding author credits to a legacy instruction leaves its unknown dates unknown', t => {
  const record = published({ editorialMeta: undefined });
  const { service } = fixture(t, record);
  const previous = service.get(record.id).instruction;

  assert.equal(previous.editorialMeta.seoAuthor, null);
  assert.equal(previous.editorialMeta.contentAuthor, null);

  const result = service.save(record.id, {
    ...previous,
    seoAuthor: 'Николай Бойков',
    contentAuthor: 'Анна Иванова',
  });

  assert.equal(result.instruction.editorialMeta.seoReady, true);
  assert.equal(result.instruction.editorialMeta.seoAuthor, 'Николай Бойков');
  assert.equal(result.instruction.editorialMeta.contentAuthor, 'Анна Иванова');
  assert.equal(result.instruction.editorialMeta.seoUpdatedAt, null);
  assert.equal(result.instruction.editorialMeta.contentUpdatedAt, null);
});

test('actual page and document edits preserve author credits and ignore forged nested replacements', t => {
  for (const change of [
    { webIntro: 'Новое вступление страницы.' },
    { instructionContent: richText('Новая редакция основного документа.') },
  ]) {
    const record = published();
    record.editorialMeta.seoAuthor = 'Николай Бойков';
    record.editorialMeta.contentAuthor = 'Анна Иванова';
    const { service } = fixture(t, record);
    const result = service.save(record.id, {
      ...service.get(record.id).instruction,
      ...change,
      editorialMeta: {
        ...record.editorialMeta,
        seoAuthor: 'Forged nested SEO author',
        contentAuthor: 'Forged nested document author',
      },
    });
    const meta = result.instruction.editorialMeta;

    assert.equal(meta.seoAuthor, 'Николай Бойков');
    assert.equal(meta.contentAuthor, 'Анна Иванова');

    if (change.webIntro) {
      assertAdvanced(meta.seoUpdatedAt, SEO_DATE);
      assert.equal(meta.contentUpdatedAt, CONTENT_DATE);
    } else {
      assert.equal(meta.seoUpdatedAt, SEO_DATE);
      assertAdvanced(meta.contentUpdatedAt, CONTENT_DATE);
    }
  }
});
