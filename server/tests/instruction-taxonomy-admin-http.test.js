import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionsRouter } from '../src/routes/adminInstructions.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Полный текст инструкции.' }] }],
};

function editorInput(overrides = {}) {
  return {
    title: 'Инструкция по охране труда для слесаря-электрика',
    slug: 'sl-elektrik-admin-taxonomy',
    instructionContent: content,
    seoTitle: 'Инструкция для слесаря-электрика',
    seoDescription: 'Полный текст инструкции для слесаря-электрика.',
    status: 'draft',
    ...overrides,
  };
}

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-admin-'));
  const repository = new InstructionsRepository(path.join(root, 'published'));
  const service = createInstructionEditorService({
    repository,
    draftsDirectory: path.join(root, 'drafts'),
    saveSnapshot: () => {},
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: 'test-user' };
    next();
  });
  app.use('/api/admin/instructions', createAdminInstructionsRouter({ service }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/instructions`;
  const request = (suffix = '', { method = 'GET', role = 'admin', body } = {}) =>
    fetch(base + suffix, {
      method,
      headers: {
        ...(role ? { 'x-test-role': role } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { repository, service, request };
}

test('taxonomy catalog is restricted to admin and exposes only safe label fields', async t => {
  const { request } = await fixture(t);
  for (const role of [null, 'user']) {
    const result = await request('/taxonomy', { role });
    assert.equal(result.status, 401);
    await result.arrayBuffer();
  }
  const response = await request('/taxonomy');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const catalog = await response.json();
  assert.equal(catalog.categories.length, 10);
  assert.equal(catalog.tags.length, 176);
  assert.equal(catalog.tags[0].suggestionRule, undefined);
  assert.equal(catalog.tags[0].indexPolicy, undefined);
});

test('manual taxonomy persists across draft and publication; invalid updates are atomic', async t => {
  const { repository, request } = await fixture(t);
  const create = await request('', {
    method: 'POST',
    body: editorInput({
      taxonomyPatch: {
        category: { mode: 'manual', id: 'office' },
        tags: { mode: 'manual', ids: ['slesar'] },
      },
    }),
  });
  assert.equal(create.status, 201);
  const saved = (await create.json()).instruction;
  assert.equal(saved.primaryCategoryId, 'office');
  assert.deepEqual(saved.tagIds, ['slesar']);
  assert.equal(repository.getById(saved.id), null);

  const publish = await request(`/${saved.id}`, {
    method: 'PUT',
    body: editorInput({ revision: saved.revision, status: 'published' }),
  });
  assert.equal(publish.status, 200);
  const live = (await publish.json()).instruction;
  assert.equal(live.primaryCategoryId, 'office');
  assert.deepEqual(live.tagIds, ['slesar']);
  assert.equal(repository.getById(saved.id).primaryCategoryId, 'office');

  const rejected = await request(`/${saved.id}`, {
    method: 'PUT',
    body: editorInput({
      revision: live.revision,
      status: 'published',
      taxonomyPatch: { tags: { mode: 'manual', ids: ['unknown'] } },
    }),
  });
  assert.equal(rejected.status, 400);
  const invalid = await rejected.json();
  assert.equal(invalid.code, 'INVALID_INSTRUCTION_TAXONOMY');
  assert.equal(repository.getById(saved.id).revision, live.revision);

  const reset = await request(`/${saved.id}`, {
    method: 'PUT',
    body: editorInput({
      revision: live.revision,
      status: 'published',
      taxonomyPatch: { category: { mode: 'auto' } },
    }),
  });
  assert.equal(reset.status, 200);
  const automatic = (await reset.json()).instruction;
  assert.equal(automatic.primaryCategoryId, 'electrical');
  assert.deepEqual(automatic.tagIds, ['slesar']);
  assert.equal(automatic.taxonomyMeta.categorySource, 'auto');
  assert.equal(automatic.taxonomyMeta.tagsSource, 'manual');
});
