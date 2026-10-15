import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createArticleRouters } from '../src/routes/articles.js';
import { createArticlesRepository } from '../src/services/articlesRepository.js';

const instructionText = 'УТВЕРЖДАЮ\n\n1. Точная редакция инструкции.\nПриложение: подпись.';

function articleInput(overrides = {}) {
  return {
    title: 'Статья с инструкцией',
    slug: 'statya-s-instrukciey',
    excerpt: 'Как применять инструкцию.',
    seoTitle: 'Инструкция: полный текст и порядок применения',
    seoDescription: 'Статья с инструкцией и скачиванием полного текста в формате PDF.',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Введение в статью.' }] },
        {
          type: 'instruction',
          attrs: { id: 'instruction_test_01', title: 'Инструкция', text: instructionText },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Продолжение статьи.' }] },
      ],
    },
    ...overrides,
  };
}

async function createFixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-articles-http-'));
  const repository = createArticlesRepository({ filePath: path.join(directory, 'articles.json') });
  const generated = [];
  const downloads = [];
  const errors = [];
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    const identity = req.get('x-test-identity');

    if (identity === 'admin') {
      req.user = { role: 'admin', sub: 'administrator' };
    } else if (identity === 'invalid-role') {
      req.user = { role: 'guest', sub: 'verified' };
    } else if (identity) {
      req.user = { role: 'user', sub: identity };
    }

    next();
  });

  const { adminArticlesRouter, articlesRouter } = createArticleRouters({
    repository,
    userLookup: id => (id === 'missing' ? null : { id, emailVerified: id === 'verified' }),
    downloadRecorder: event => downloads.push(event),
    pdfGenerator:
      options.pdfGenerator ??
      (async block => {
        generated.push(block);

        return Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1500, 32)]);
      }),
  });

  app.use('/api/admin/articles', adminArticlesRouter);
  app.use('/api/articles', articlesRouter);
  app.use((error, _req, res, _next) => {
    errors.push(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  const server = app.listen(0, '127.0.0.1');

  await once(server, 'listening');

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (url, { identity, method = 'GET', body } = {}) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        ...(identity ? { 'x-test-identity': identity } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  return { repository, request, generated, downloads, errors };
}

test('article admin API rejects unauthenticated and ordinary-user CRUD requests', async t => {
  const { repository, request } = await createFixture(t);
  const article = repository.create(articleInput());

  for (const identity of [undefined, 'verified', 'unverified', 'invalid-role']) {
    for (const [url, method, body] of [
      ['/api/admin/articles', 'GET', undefined],
      [`/api/admin/articles/${article.id}`, 'GET', undefined],
      ['/api/admin/articles', 'POST', articleInput({ slug: 'unauthorized-article' })],
      [
        `/api/admin/articles/${article.id}`,
        'PUT',
        { ...articleInput({ title: 'Unauthorized edit' }), revision: article.revision },
      ],
      [`/api/admin/articles/${article.id}`, 'DELETE', { revision: article.revision }],
    ]) {
      const response = await request(url, { identity, method, body });

      assert.equal(response.status, 401, `${identity ?? 'guest'} ${method} ${url}`);
      await response.arrayBuffer();
    }
  }

  assert.equal(repository.list().length, 1);
  assert.equal(repository.getById(article.id).title, article.title);
});

test('article CRUD publishes content, reports stale revision and removes it from public access', async t => {
  const { request } = await createFixture(t);
  const createResponse = await request('/api/admin/articles', {
    identity: 'admin',
    method: 'POST',
    body: articleInput(),
  });

  assert.equal(createResponse.status, 201);

  const { article: draft } = await createResponse.json();
  const hiddenResponse = await request(`/api/articles/${draft.slug}`);

  assert.equal(hiddenResponse.status, 404);
  await hiddenResponse.arrayBuffer();

  const publishResponse = await request(`/api/admin/articles/${draft.id}`, {
    identity: 'admin',
    method: 'PUT',
    body: { ...articleInput({ status: 'published' }), revision: draft.revision },
  });

  assert.equal(publishResponse.status, 200);

  const { article: published } = await publishResponse.json();
  const publicResponse = await request(`/api/articles/${draft.slug}`);

  assert.equal(publicResponse.status, 200);

  const publicArticle = (await publicResponse.json()).article;

  assert.equal(publicArticle.content.content[1].attrs.text, instructionText);
  assert.equal(publicArticle.content.content[2].content[0].text, 'Продолжение статьи.');

  const staleResponse = await request(`/api/admin/articles/${draft.id}`, {
    identity: 'admin',
    method: 'PUT',
    body: { ...articleInput({ title: 'Stale edit' }), revision: draft.revision },
  });

  assert.equal(staleResponse.status, 409);
  await staleResponse.arrayBuffer();

  const deleteResponse = await request(`/api/admin/articles/${draft.id}`, {
    identity: 'admin',
    method: 'DELETE',
    body: { revision: published.revision },
  });

  assert.ok([200, 204].includes(deleteResponse.status));
  await deleteResponse.arrayBuffer();

  const deletedResponse = await request(`/api/articles/${draft.slug}`);

  assert.equal(deletedResponse.status, 404);
  await deletedResponse.arrayBuffer();
});

test('public article lists exclude drafts and omit full editor content', async t => {
  const { repository, request } = await createFixture(t);

  repository.create(articleInput({ slug: 'draft-only' }));
  repository.create(articleInput({ slug: 'published-only', status: 'published' }));

  const response = await request('/api/articles');

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].slug, 'published-only');
  assert.equal(body.items[0].content, undefined);
  assert.ok(!JSON.stringify(body).includes('draft-only'));
  assert.ok(!JSON.stringify(body).includes(instructionText));
});

test('article PDF uses existing verified-user access rules and exact embedded wording', async t => {
  const { repository, request, generated, downloads } = await createFixture(t);
  const article = repository.create(articleInput({ status: 'published' }));
  const url = `/api/articles/${article.slug}/instructions/instruction_test_01/pdf`;

  for (const [identity, expectedStatus] of [
    [undefined, 401],
    ['unverified', 403],
    ['missing', 401],
    ['invalid-role', 401],
    ['verified', 200],
    ['admin', 200],
  ]) {
    const response = await request(url, { identity });

    assert.equal(response.status, expectedStatus, `PDF access for ${identity ?? 'guest'}`);

    if (expectedStatus === 200) {
      assert.ok(response.headers.get('content-type').includes('application/pdf'));
      assert.ok(response.headers.get('content-disposition').includes('attachment;'));
      assert.ok(response.headers.get('cache-control').includes('no-store'));

      const buffer = Buffer.from(await response.arrayBuffer());

      assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    } else {
      await response.arrayBuffer();
    }
  }

  assert.equal(generated.length, 2);
  assert.ok(generated.every(block => block.attrs.text === instructionText));
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].userId, 'verified');
  assert.equal(downloads[0].title, 'Инструкция');
});

test('draft, unpublished and unknown instruction PDFs never invoke the generator', async t => {
  const { repository, request, generated } = await createFixture(t);
  const draft = repository.create(articleInput());
  const pdfUrl = `/api/articles/${draft.slug}/instructions/instruction_test_01/pdf`;
  const draftResponse = await request(pdfUrl, { identity: 'admin' });

  assert.equal(draftResponse.status, 404);
  await draftResponse.arrayBuffer();

  const published = repository.update(draft.id, articleInput({ status: 'published' }), {
    revision: draft.revision,
  });
  const absentResponse = await request(
    `/api/articles/${draft.slug}/instructions/unknown_block/pdf`,
    { identity: 'verified' },
  );

  assert.equal(absentResponse.status, 404);
  await absentResponse.arrayBuffer();

  repository.update(draft.id, articleInput({ status: 'draft' }), {
    revision: published.revision,
  });

  const unpublishedResponse = await request(pdfUrl, { identity: 'verified' });

  assert.equal(unpublishedResponse.status, 404);
  await unpublishedResponse.arrayBuffer();
  assert.equal(generated.length, 0);
});

test('invalid PDF generation returns an error without sending a downloadable success response', async t => {
  const { repository, request, errors, downloads } = await createFixture(t, {
    pdfGenerator: async () => Buffer.from('not a PDF'),
  });
  const article = repository.create(articleInput({ status: 'published' }));
  const response = await request(
    `/api/articles/${article.slug}/instructions/instruction_test_01/pdf`,
    { identity: 'verified' },
  );

  assert.equal(response.status, 500);
  assert.ok(!response.headers.get('content-type').includes('application/pdf'));
  assert.equal(response.headers.get('content-disposition'), null);
  const body = await response.json();

  assert.ok(!JSON.stringify(body).includes('Article PDF generator'));
  assert.equal(errors.length, 1);
  assert.equal(downloads.length, 0);
});
