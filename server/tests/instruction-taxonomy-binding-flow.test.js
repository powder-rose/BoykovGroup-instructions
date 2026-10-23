import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createAdminInstructionsRouter } from '../src/routes/adminInstructions.js';
import { createAdminInstructionTaxonomyRouter } from '../src/routes/adminInstructionTaxonomy.js';
import { createInstructionEditorService } from '../src/services/instructionEditorService.js';
import {
  rollbackInstruction,
  saveInstructionSnapshot,
} from '../src/services/instructionHistoryService.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../src/services/instructionTaxonomyAssignmentCatalog.js';
import { getInstructionTaxonomyDisplay } from '../src/services/instructionTaxonomyDisplayService.js';
import {
  filterInstructionsByTaxonomy,
  getInstructionTaxonomyFilterOptions,
} from '../src/services/instructionTaxonomyFilterService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { createInstructionTaxonomyRegistryService } from '../src/services/instructionTaxonomyRegistryService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';

const document = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '1.1. Проверить инструмент.' }] }],
};
const chosenTags = ['T01', 'T02', 'T03', 'T04', 'T47', 'T48', 'sosudy-pod-davleniem'];

function input(overrides = {}) {
  return {
    title: 'Инструкция по охране труда для электромонтёра',
    slug: 'elektromonter-binding-flow',
    instructionContent: document,
    seoTitle: 'Инструкция электромонтёра',
    seoDescription: 'Проверочная редакция инструкции электромонтёра.',
    status: 'published',
    ...overrides,
  };
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-binding-flow-'));
  const draftsDirectory = path.join(directory, 'drafts');
  const historyRoot = path.join(directory, 'history');
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const taxonomyRepository = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(directory, 'taxonomy.json'),
  });
  const editor = createInstructionEditorService({
    repository,
    taxonomyRepository,
    draftsDirectory,
    saveSnapshot: record => saveInstructionSnapshot(record, { historyRoot }),
  });
  const taxonomy = createInstructionTaxonomyRegistryService({
    repository: taxonomyRepository,
    getInstructions: () => editor.getTaxonomyReferences(),
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { role: 'admin' };
    next();
  });
  app.use(
    '/editor',
    createAdminInstructionsRouter({
      service: editor,
      getAssignmentCatalog: () =>
        getInstructionTaxonomyAssignmentCatalog(taxonomyRepository.read()),
    }),
  );
  app.use('/taxonomy', createAdminInstructionTaxonomyRouter({ service: taxonomy }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  return { repository, taxonomyRepository, directory, draftsDirectory, historyRoot, request };
}

test('manual bindings remain consistent across editor publication, metadata edits, filters and history rollback', async t => {
  const f = await fixture(t);
  const dictionary = await f.request('/editor/assignment-taxonomy');
  assert.equal(dictionary.status, 200);
  assert.equal(dictionary.body.revision, 0);
  assert.equal(dictionary.body.sections.length, 52);

  const missingSection = await f.request('/editor', 'POST', input());
  assert.equal(missingSection.status, 400);
  assert.equal(f.repository.getAll().length, 0);

  const created = await f.request(
    '/editor',
    'POST',
    input({
      taxonomyPatch: {
        category: { mode: 'manual', id: 'P10' },
        tags: { mode: 'manual', ids: chosenTags },
        registryRevision: 0,
      },
    }),
  );
  assert.equal(created.status, 201);
  const original = created.body.instruction;
  assert.equal(original.primaryCategoryId, 'P10');
  assert.deepEqual(original.tagIds, chosenTags);
  assert.equal(original.taxonomyDisplay.tags.length, 7);
  assert.deepEqual(original.instructionContent, document);

  const draft = await f.request(
    `/editor/${original.id}`,
    'PUT',
    input({
      revision: original.revision,
      status: 'draft',
      taxonomyPatch: {
        category: { mode: 'manual', id: 'W02' },
        tags: { mode: 'manual', ids: [] },
        registryRevision: 0,
      },
    }),
  );
  assert.equal(draft.status, 200);
  assert.equal(draft.body.instruction.primaryCategoryId, 'W02');
  assert.deepEqual(draft.body.instruction.tagIds, []);
  assert.deepEqual(f.repository.getById(original.id).tagIds, chosenTags);
  for (const [kind, code, publishedInstructions] of [
    ['section', 'P10', 1],
    ['section', 'W02', 0],
    ['tag', 'T47', 1],
    ['tag', 'T48', 1],
  ]) {
    const usage = await f.request(`/taxonomy/${kind}/${code}/usage`);
    assert.deepEqual(usage.body.usage, { references: 1, publishedInstructions });
    const blocked = await f.request(`/taxonomy/${kind}/${code}`, 'DELETE', { expectedRevision: 0 });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.code, 'TAXONOMY_ENTITY_IN_USE');
  }

  const rename = await f.request('/taxonomy/tag/T47', 'PUT', {
    expectedRevision: 0,
    patch: { name: 'Газовые баллоны — проверенное название' },
  });
  assert.equal(rename.status, 200);
  const catalog = (await f.request('/editor/assignment-taxonomy')).body;
  assert.equal(catalog.revision, 1);
  const published = f.repository.getById(original.id);
  const display = getInstructionTaxonomyDisplay(published, { catalog });
  assert.equal(
    display.tags.find(item => item.id === 'T47').label,
    rename.body.registry.tags.find(item => item.code === 'T47').name,
  );
  assert.deepEqual(
    display.tags.map(item => item.id),
    chosenTags,
  );
  assert.deepEqual(Object.keys(display).sort(), ['category', 'tags']);
  assert.ok(display.tags.every(item => Object.keys(item).sort().join(',') === 'id,label'));
  assert.equal(
    filterInstructionsByTaxonomy([published], { category: 'P10', tag: 'T47' }, { catalog }).length,
    1,
  );
  const options = getInstructionTaxonomyFilterOptions([published, draft.body.instruction], {
    catalog,
  });
  assert.equal(options.tags.find(item => item.id === 'T47').count, 1);
  assert.equal(
    options.categories.some(item => item.id === 'W02'),
    false,
  );

  const publicFile = path.join(f.repository.dir, `${original.id}.json`);
  const draftFile = path.join(
    f.draftsDirectory,
    `${Buffer.from(original.id).toString('base64url')}.json`,
  );
  const publicBytes = fs.readFileSync(publicFile);
  const draftBytes = fs.readFileSync(draftFile);
  const stale = await f.request(
    `/editor/${original.id}`,
    'PUT',
    input({
      revision: draft.body.instruction.revision,
      taxonomyPatch: {
        category: { mode: 'manual', id: 'W02' },
        tags: { mode: 'manual', ids: [] },
        registryRevision: 0,
      },
    }),
  );
  assert.equal(stale.status, 409);
  assert.deepEqual(fs.readFileSync(publicFile), publicBytes);
  assert.deepEqual(fs.readFileSync(draftFile), draftBytes);

  const republished = await f.request(
    `/editor/${original.id}`,
    'PUT',
    input({
      revision: draft.body.instruction.revision,
      taxonomyPatch: {
        category: { mode: 'manual', id: 'W02' },
        tags: { mode: 'manual', ids: [] },
        registryRevision: 1,
      },
    }),
  );
  assert.equal(republished.status, 200);
  const current = republished.body.instruction;
  assert.equal(current.primaryCategoryId, 'W02');
  assert.deepEqual(current.tagIds, []);
  assert.equal(current.taxonomyMeta.needsReview, false);
  for (const field of ['id', 'slug', 'createdAt', 'publishedAt', 'contentHash']) {
    assert.equal(current[field], original[field]);
  }
  assert.deepEqual(current.instructionContent, original.instructionContent);
  assert.deepEqual(current.editorialMeta, original.editorialMeta);

  const removed = await f.request('/taxonomy/tag/T47', 'DELETE', { expectedRevision: 1 });
  assert.equal(removed.status, 200);
  const currentBytes = fs.readFileSync(publicFile);
  const historyFiles = fs.readdirSync(
    path.join(f.historyRoot, Buffer.from(original.id).toString('base64url')),
  );
  assert.equal(historyFiles.length, 1);
  assert.throws(
    () =>
      rollbackInstruction(original.id, {
        repository: f.repository,
        historyRoot: f.historyRoot,
        draftsDirectory: f.draftsDirectory,
        taxonomyRepository: f.taxonomyRepository,
      }),
    /T47/,
  );
  assert.deepEqual(fs.readFileSync(publicFile), currentBytes);
  assert.deepEqual(
    fs.readdirSync(path.join(f.historyRoot, Buffer.from(original.id).toString('base64url'))),
    historyFiles,
  );
});
