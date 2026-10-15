import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionsRouter } from '../src/routes/adminInstructions.js';
import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

function editorInput(overrides = {}) {
  return {
    title: 'Инструкция по охране труда при работе на высоте',
    slug: 'rabota-na-vysote-manual',
    webIntro: 'Полный документ для чтения и скачивания.',
    instructionContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Полный текст инструкции.' }] },
      ],
    },
    explanationContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Пояснение после инструкции.' }] },
      ],
    },
    seoTitle: 'Инструкция при работе на высоте: полный текст',
    seoDescription: 'Полный текст инструкции при работе на высоте и пояснения по её применению.',
    status: 'draft',
    ...overrides,
  };
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-instruction-editor-http-'));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const service = createInstructionEditorService({
    repository,
    draftsDirectory: path.join(directory, 'drafts'),
    saveSnapshot: () => {},
  });
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');

    if (role) {
      req.user = { role, sub: 'fixture-user' };
    }

    next();
  });
  app.use('/api/admin/instructions', createAdminInstructionsRouter({ service }));
  app.use('/api/instructions', createInstructionPagesRouter({ repository }));
  app.use((error, _req, res, _next) => {
    res.status(error.status ?? 500).json({ error: 'Не удалось выполнить запрос' });
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

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/instructions`;
  const request = (suffix = '', { method = 'GET', role = 'admin', body } = {}) =>
    fetch(`${baseUrl}${suffix}`, {
      method,
      headers: {
        ...(role ? { 'x-test-role': role } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const publicRequest = (suffix, role) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/instructions${suffix}`, {
      headers: role ? { 'x-test-role': role } : {},
    });

  return { repository, service, request, publicRequest };
}

test('instruction editor routes enforce admin access before every read or write', async t => {
  const { repository, service, request } = await fixture(t);
  const published = service.save(null, editorInput({ status: 'published' })).instruction;

  for (const role of [null, 'user', 'guest']) {
    for (const [suffix, method, body] of [
      ['', 'GET', undefined],
      [`/${published.id}`, 'GET', undefined],
      ['', 'POST', editorInput({ slug: 'unauthorized-create' })],
      [`/${published.id}`, 'PUT', { ...editorInput(), revision: published.revision }],
      [`/${published.id}`, 'DELETE', { revision: published.revision }],
      [`/${published.id}/draft`, 'DELETE', { revision: published.revision }],
      [`/${published.id}/unpublish`, 'POST', { revision: published.revision }],
    ]) {
      const response = await request(suffix, { role, method, body });

      assert.equal(response.status, 401, `${role ?? 'guest'} ${method} ${suffix}`);
      await response.arrayBuffer();
    }
  }

  assert.equal(service.list().length, 1);
  assert.equal(repository.getById(published.id).title, published.title);
});

test('admin HTTP flow creates, publishes and edits a separate draft with revision conflicts', async t => {
  const { repository, request } = await fixture(t);
  const createdResponse = await request('', { method: 'POST', body: editorInput() });

  assert.equal(createdResponse.status, 201);

  const created = await createdResponse.json();
  const id = created.instruction.id;

  assert.equal(created.hasDraft, true);
  assert.equal(created.hasPublishedVersion, false);
  assert.equal(repository.getById(id), null);

  const publishResponse = await request(`/${id}`, {
    method: 'PUT',
    body: editorInput({ status: 'published', revision: created.instruction.revision }),
  });

  assert.equal(publishResponse.status, 200);

  const published = await publishResponse.json();
  const editResponse = await request(`/${id}`, {
    method: 'PUT',
    body: editorInput({
      title: 'Неопубликованное изменение',
      revision: published.instruction.revision,
    }),
  });

  assert.equal(editResponse.status, 200);

  const edited = await editResponse.json();

  assert.equal(edited.hasDraft, true);
  assert.equal(edited.hasPublishedVersion, true);
  assert.equal(repository.getById(id).title, published.instruction.title);

  const staleResponse = await request(`/${id}`, {
    method: 'PUT',
    body: editorInput({ title: 'Stale update', revision: published.instruction.revision }),
  });

  assert.equal(staleResponse.status, 409);
  await staleResponse.arrayBuffer();

  const getResponse = await request(`/${id}`);

  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).instruction.title, edited.instruction.title);

  const listResponse = await request();

  assert.equal(listResponse.status, 200);

  const { items } = await listResponse.json();

  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  assert.equal(items[0].instructionContent, undefined);
});

test('admin HTTP routes discard a draft, unpublish to draft and delete the document', async t => {
  const { repository, service, request } = await fixture(t);
  const published = service.save(null, editorInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision }),
  ).instruction;
  const discardResponse = await request(`/${published.id}/draft`, {
    method: 'DELETE',
    body: { revision: draft.revision },
  });

  assert.equal(discardResponse.status, 204);
  await discardResponse.arrayBuffer();

  const discardedResponse = await request(`/${published.id}`);
  const discarded = await discardedResponse.json();

  assert.equal(discarded.hasDraft, false);
  assert.equal(discarded.hasPublishedVersion, true);

  const unpublishResponse = await request(`/${published.id}/unpublish`, {
    method: 'POST',
    body: { revision: discarded.instruction.revision },
  });

  assert.equal(unpublishResponse.status, 200);

  const unpublished = await unpublishResponse.json();

  assert.equal(unpublished.hasDraft, true);
  assert.equal(unpublished.hasPublishedVersion, false);
  assert.equal(repository.getById(published.id), null);

  const removeResponse = await request(`/${published.id}`, {
    method: 'DELETE',
    body: { revision: unpublished.instruction.revision },
  });

  assert.ok([200, 204].includes(removeResponse.status));
  await removeResponse.arrayBuffer();

  const missingResponse = await request(`/${published.id}`);

  assert.equal(missingResponse.status, 404);
  await missingResponse.arrayBuffer();
});

test('malformed editor content and duplicate slugs return client errors with no partial writes', async t => {
  const { repository, service, request } = await fixture(t);
  const published = service.save(null, editorInput({ status: 'published' })).instruction;
  const duplicateResponse = await request('', {
    method: 'POST',
    body: editorInput({ slug: published.slug }),
  });

  assert.equal(duplicateResponse.status, 409);
  await duplicateResponse.arrayBuffer();

  const invalidResponse = await request(`/${published.id}`, {
    method: 'PUT',
    body: editorInput({
      revision: published.revision,
      instructionContent: { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
    }),
  });

  assert.equal(invalidResponse.status, 400);
  await invalidResponse.arrayBuffer();
  assert.equal(service.get(published.id).hasDraft, false);
  assert.equal(repository.getAll().length, 1);
  assert.equal(repository.getById(published.id).revision, published.revision);
});

test('public instruction pages resolve live slugs and ID aliases without leaking draft changes', async t => {
  const { service, publicRequest } = await fixture(t);
  const published = service.save(null, editorInput({ status: 'published' })).instruction;
  const renamed = service.save(published.id, {
    ...editorInput({ status: 'published', slug: 'novyy-public-slug' }),
    revision: published.revision,
  }).instruction;

  service.save(published.id, {
    ...editorInput({ slug: 'private-draft-slug', title: 'PRIVATE_DRAFT_TITLE' }),
    revision: renamed.revision,
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PRIVATE_DRAFT_CONTENT' }] }],
    },
  });

  for (const slug of [published.id, published.slug, renamed.slug]) {
    const response = await publicRequest(`/page/${slug}`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.id, published.id);
    assert.equal(body.slug, renamed.slug);
    assert.equal(body.title, published.title);
    assert.equal(body.webIntro, published.webIntro);
    assert.deepEqual(body.instructionContent, published.instructionContent);
    assert.deepEqual(body.explanationContent, published.explanationContent);
    assert.ok(Array.isArray(body.relatedInstructions));
    assert.ok(!JSON.stringify(body).includes('PRIVATE_DRAFT_'));
  }

  const hiddenResponse = await publicRequest('/page/private-draft-slug');

  assert.equal(hiddenResponse.status, 404);
  await hiddenResponse.arrayBuffer();
});

test('public related instructions exclude drafts and unpublished documents', async t => {
  const { service, publicRequest } = await fixture(t);
  const first = service.save(null, editorInput({ status: 'published' })).instruction;
  const related = service.save(
    null,
    editorInput({
      status: 'published',
      title: 'Инструкция по охране труда при работе на высоте с лестницей',
      slug: 'rabota-na-vysote-lestnica',
    }),
  ).instruction;
  const draft = service.save(
    null,
    editorInput({
      title: 'Инструкция по охране труда при работе на высоте с площадкой',
      slug: 'draft-rabota-na-vysote',
    }),
  ).instruction;
  const response = await publicRequest(`/page/${first.slug}`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.ok(body.relatedInstructions.some(item => item.id === related.id));
  assert.ok(body.relatedInstructions.every(item => ![first.id, draft.id].includes(item.id)));

  service.unpublish(related.id, { revision: related.revision });

  const refreshed = await publicRequest(`/page/${first.slug}`);

  assert.equal(refreshed.status, 200);
  assert.ok((await refreshed.json()).relatedInstructions.every(item => item.id !== related.id));

  for (const slug of [draft.id, draft.slug, related.id, related.slug]) {
    const hidden = await publicRequest(`/page/${slug}`);

    assert.equal(hidden.status, 404);
    await hidden.arrayBuffer();
  }
});

test('editorial metadata remains available to admin but is absent from public page responses', async t => {
  const { repository, service, request, publicRequest } = await fixture(t);
  const published = service.save(null, editorInput({ status: 'published' })).instruction;
  const editorialMeta = {
    seoReady: true,
    seoUpdatedAt: '2026-04-01T12:00:00.000Z',
    contentUpdatedAt: '2026-03-01T12:00:00.000Z',
    seoAuthor: 'SEO_EDITOR_PRIVATE_NAME',
    contentAuthor: 'TEXT_EDITOR_PRIVATE_NAME',
  };
  repository.save({ ...published, editorialMeta });

  const adminResponse = await request(`/${published.id}`);
  assert.equal(adminResponse.status, 200);
  assert.equal(
    (await adminResponse.json()).instruction.editorialMeta.seoUpdatedAt,
    editorialMeta.seoUpdatedAt,
  );

  for (const role of [undefined, 'user', 'admin']) {
    const response = await publicRequest(`/page/${published.slug}`, role);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(Object.hasOwn(data, 'editorialMeta'), false);
    assert.equal(JSON.stringify(data).includes('SEO_EDITOR_PRIVATE_NAME'), false);
    assert.equal(JSON.stringify(data).includes('TEXT_EDITOR_PRIVATE_NAME'), false);
    assert.deepEqual(data.instructionContent, published.instructionContent);
    assert.equal(data.seoDescription, published.seoDescription);
  }

  assert.deepEqual(repository.getById(published.id).editorialMeta, editorialMeta);
});
