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
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';

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
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(root, 'taxonomy.json'),
  });
  const service = createInstructionEditorService({
    repository,
    draftsDirectory: path.join(root, 'drafts'),
    taxonomyRepository,
    saveSnapshot: () => {},
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role, sub: 'test-user' };
    next();
  });
  app.use(
    '/api/admin/instructions',
    createAdminInstructionsRouter({
      service,
      getAssignmentCatalog: () =>
        getInstructionTaxonomyAssignmentCatalog(taxonomyRepository.read()),
    }),
  );
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
  return { repository, service, taxonomyRepository, request };
}

test('taxonomy catalog is restricted to admin and exposes only safe label fields', async t => {
  const { request, taxonomyRepository } = await fixture(t);
  for (const role of [null, 'user']) {
    for (const endpoint of ['/taxonomy', '/assignment-taxonomy']) {
      const result = await request(endpoint, { role });
      assert.equal(result.status, 401);
      await result.arrayBuffer();
    }
  }
  const response = await request('/taxonomy');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const catalog = await response.json();
  assert.equal(catalog.categories.length, 10);
  assert.equal(catalog.tags.length, 371);
  assert.equal(catalog.tags[0].suggestionRule, undefined);
  assert.equal(catalog.tags[0].indexPolicy, undefined);
  const assignments = await request('/assignment-taxonomy');
  assert.equal(assignments.status, 200);
  assert.equal(assignments.headers.get('cache-control'), 'private, no-store');
  const choices = await assignments.json();
  assert.equal(choices.revision, 0);
  assert.equal(choices.sections.length, 52);
  assert.equal(choices.tags.length, 79);
  assert.equal(choices.legacyTags.length, 371);
  assert.deepEqual(Object.keys(choices.sections[0]), ['id', 'label', 'catalogId']);
  assert.deepEqual(Object.keys(choices.tags[0]), ['id', 'label', 'type']);

  const label = 'Проверка изолированного справочника';
  taxonomyRepository.update(
    state => {
      state.tags.find(tag => tag.code === 'T01').name = label;
      return state;
    },
    { expectedRevision: 0 },
  );
  const updated = await request('/assignment-taxonomy');
  assert.equal(updated.status, 200);
  const updatedChoices = await updated.json();
  assert.equal(updatedChoices.revision, 1);
  assert.equal(updatedChoices.tags.find(tag => tag.id === 'T01').label, label);
});

test('new admin drafts and publications require a canonical section and retain optional empty tags', async t => {
  const { repository, service, request } = await fixture(t);
  for (const status of ['draft', 'published']) {
    for (const taxonomyPatch of [
      undefined,
      { category: { mode: 'manual', id: null } },
      { category: { mode: 'manual', id: 'office' } },
    ]) {
      const response = await request('', {
        method: 'POST',
        body: editorInput({ status, taxonomyPatch }),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'INVALID_INSTRUCTION_TAXONOMY');
      assert.equal(service.list().length, 0);
      assert.equal(repository.getAll().length, 0);
    }
  }
  for (const status of ['draft', 'published']) {
    const response = await request('', {
      method: 'POST',
      body: editorInput({
        status,
        slug: `canonical-${status}`,
        taxonomyPatch: { category: { mode: 'manual', id: 'W01' }, registryRevision: 0 },
      }),
    });
    assert.equal(response.status, 201);
    const saved = (await response.json()).instruction;
    assert.equal(saved.primaryCategoryId, 'W01');
    assert.deepEqual(saved.tagIds, []);
    assert.equal(saved.taxonomyMeta.tagsSource, 'manual');
    assert.equal(saved.taxonomyMeta.needsReview, false);
  }
});

test('legacy manual taxonomy persists across draft and publication; invalid updates are atomic', async t => {
  const { repository, service, request } = await fixture(t);
  repository.save({ id: 'legacy-taxonomy', ...editorInput({ status: 'published' }) });
  const draft = service.unpublish('legacy-taxonomy', { revision: 0 }).instruction;
  const create = await request('/legacy-taxonomy', {
    method: 'PUT',
    body: editorInput({
      revision: draft.revision,
      taxonomyPatch: {
        category: { mode: 'manual', id: 'office' },
        tags: { mode: 'manual', ids: ['slesar'] },
      },
    }),
  });
  assert.equal(create.status, 200);
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
