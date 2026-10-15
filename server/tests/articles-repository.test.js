import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createArticlesRepository } from '../src/services/articlesRepository.js';

function createFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-articles-'));
  const filePath = path.join(directory, 'articles.json');

  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return { repository: createArticlesRepository({ filePath }), filePath, directory };
}

function articleInput(overrides = {}) {
  return {
    title: 'Как подготовить инструкцию',
    slug: 'kak-podgotovit-instrukciyu',
    excerpt: 'Статья с полным текстом инструкции.',
    seoTitle: 'Как подготовить инструкцию: полный текст',
    seoDescription: 'Порядок подготовки инструкции и скачивание полного текста документа.',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Текст до инструкции.' }] },
        {
          type: 'instruction',
          attrs: {
            id: 'instruction_test_01',
            title: 'Инструкция',
            text: 'УТВЕРЖДАЮ\n\n1. Полный текст.\nПриложение А. Подпись.',
          },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Текст после инструкции.' }] },
      ],
    },
    ...overrides,
  };
}

test('article repository persists drafts and publishes only explicit published revisions', t => {
  const { repository, filePath } = createFixture(t);
  const draft = repository.create(articleInput());

  assert.equal(draft.status, 'draft');
  assert.equal(repository.list().length, 1);
  assert.deepEqual(repository.list({ publishedOnly: true }), []);
  assert.equal(repository.getPublishedBySlug(draft.slug), null);

  const reloaded = createArticlesRepository({ filePath });

  assert.deepEqual(reloaded.getById(draft.id).content, draft.content);

  const published = reloaded.update(draft.id, articleInput({ status: 'published' }), {
    revision: draft.revision,
  });

  assert.ok(published.publishedAt);
  assert.notEqual(published.revision, draft.revision);
  assert.equal(reloaded.getPublishedBySlug(draft.slug).id, draft.id);
  assert.equal(reloaded.list({ publishedOnly: true }).length, 1);

  const unpublished = reloaded.update(draft.id, articleInput({ status: 'draft' }), {
    revision: published.revision,
  });

  assert.equal(unpublished.status, 'draft');
  assert.equal(reloaded.getPublishedBySlug(draft.slug), null);
  assert.deepEqual(reloaded.list({ publishedOnly: true }), []);
});

test('article optimistic revision prevents stale edits and stale deletion', t => {
  const { repository } = createFixture(t);
  const original = repository.create(articleInput());
  const changed = repository.update(original.id, articleInput({ title: 'Новая версия' }), {
    revision: original.revision,
  });

  assert.throws(
    () =>
      repository.update(original.id, articleInput({ title: 'Потерянная правка' }), {
        revision: original.revision,
      }),
    { status: 409 },
  );
  assert.throws(() => repository.remove(original.id, { revision: original.revision }), {
    status: 409,
  });
  assert.equal(repository.getById(original.id).title, 'Новая версия');

  repository.remove(original.id, { revision: changed.revision });

  assert.equal(repository.getById(original.id), null);
});

test('article repository rejects duplicate slugs and invalid metadata without changing storage', t => {
  const { repository, filePath } = createFixture(t);

  repository.create(articleInput());

  const before = fs.readFileSync(filePath, 'utf8');

  assert.throws(() => repository.create(articleInput()), { status: 409 });

  for (const invalid of [
    { title: '' },
    { slug: '../private-data' },
    { slug: 'contains/slash' },
    { status: 'deleted' },
    { content: { type: 'doc', content: [{ type: 'iframe' }] } },
  ]) {
    assert.throws(() => repository.create(articleInput(invalid)), { status: 400 });
  }

  assert.equal(fs.readFileSync(filePath, 'utf8'), before);
});

test('article results are copies so callers cannot mutate persisted drafts accidentally', t => {
  const { repository } = createFixture(t);
  const created = repository.create(articleInput());

  created.title = 'Changed outside repository';
  created.content.content[1].attrs.text = 'Replaced without saving';

  const listed = repository.list();

  listed[0].title = 'Changed through list';

  const fetched = repository.getById(created.id);

  assert.equal(fetched.title, 'Как подготовить инструкцию');
  assert.ok(fetched.content.content[1].attrs.text.includes('Приложение А. Подпись.'));
});

test('publication requires SEO metadata and readable content while unfinished drafts can be saved', t => {
  const { repository } = createFixture(t);
  const draft = repository.create(
    articleInput({
      seoTitle: '',
      seoDescription: '',
      content: { type: 'doc', content: [] },
    }),
  );

  assert.equal(draft.status, 'draft');

  for (const incomplete of [
    { seoTitle: '' },
    { seoDescription: '' },
    { content: { type: 'doc', content: [] } },
    {
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }],
      },
    },
  ]) {
    assert.throws(
      () =>
        repository.update(draft.id, articleInput({ status: 'published', ...incomplete }), {
          revision: draft.revision,
        }),
      { status: 400 },
    );
  }

  assert.equal(repository.getById(draft.id).revision, draft.revision);
  assert.equal(repository.getById(draft.id).status, 'draft');
});

test(
  'interrupted article write preserves committed JSON and its revision',
  { concurrency: false },
  t => {
    const { repository, filePath, directory } = createFixture(t);
    const original = repository.create(articleInput());
    const persistedBefore = fs.readFileSync(filePath, 'utf8');
    const filesBefore = fs.readdirSync(directory).sort();
    const originalWrite = fs.writeFileSync;

    fs.writeFileSync = function (target, data, options) {
      if (path.dirname(String(target)) === directory) {
        originalWrite.call(fs, target, '{"incomplete":', options);

        const error = new Error('simulated article disk exhaustion');

        error.code = 'ENOSPC';

        throw error;
      }

      return originalWrite.call(fs, target, data, options);
    };

    try {
      assert.throws(
        () =>
          repository.update(original.id, articleInput({ title: 'Must not persist' }), {
            revision: original.revision,
          }),
        error => error.status === 500 && error.cause?.code === 'ENOSPC',
      );
    } finally {
      fs.writeFileSync = originalWrite;
    }

    assert.equal(fs.readFileSync(filePath, 'utf8'), persistedBefore);
    assert.equal(repository.getById(original.id).revision, original.revision);
    assert.equal(repository.getById(original.id).title, original.title);
    assert.deepEqual(fs.readdirSync(directory).sort(), filesBefore);
  },
);

test('corrupt article storage fails closed and is not replaced by a new empty store', t => {
  const { filePath } = createFixture(t);
  const corrupted = '{"articles": [ incomplete';

  fs.writeFileSync(filePath, corrupted, 'utf8');

  assert.throws(() => {
    const repository = createArticlesRepository({ filePath });

    repository.create(articleInput());
  });
  assert.equal(fs.readFileSync(filePath, 'utf8'), corrupted);
});
