import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { listInstructionTaxonomyEntities } from '../src/services/instructionTaxonomyRegistryModel.js';
import {
  applyInstructionTaxonomyPublication,
  buildInstructionTaxonomyPublication,
} from '../src/services/instructionTaxonomyPublication.js';
import { publishInstructionTaxonomy } from '../scripts/publishInstructionTaxonomy.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs publication '));
  const data = path.join(root, 'data');
  fs.mkdirSync(data);
  const file = path.join(data, 'instruction-taxonomy.json');
  const repository = createInstructionTaxonomyRegistryRepository({ filePath: file });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, file, repository };
}

test('the complete specification structure receives public routes without opening new pages to indexing', () => {
  const before = getInstructionTaxonomyRegistrySeed();
  const original = structuredClone(before);
  const { after, urls } = buildInstructionTaxonomyPublication(before);
  assert.deepEqual(before, original);
  assert.equal(after.catalogs.length, 2);
  assert.equal(after.sections.length, 52);
  assert.equal(after.tags.length, 79);
  assert.equal(urls.length, 134);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.root.indexingEnabled, true);
  assert.equal(after.catalogs.find(x => x.code === 'H01').slug, 'po-professiyam');
  for (const entity of listInstructionTaxonomyEntities(after)) {
    assert.equal(entity.status, 'published');
    if (entity.kind !== 'root') assert.equal(entity.indexingEnabled, false);
    assert.deepEqual(entity.seoContent, { type: 'doc', content: [] });
    assert.deepEqual(entity.introContent, { type: 'doc', content: [] });
  }
  assert.equal(new Set(urls.map(x => x.path)).size, 134);
  assert.equal(buildInstructionTaxonomyPublication(after).changes.length, 0);
});

test('activation preserves editorial fields, custom elements, indexing choices and historical published routes', () => {
  const before = getInstructionTaxonomyRegistrySeed();
  const catalog = before.catalogs.find(x => x.code === 'H01');
  catalog.status = 'published';
  catalog.routeApproved = true;
  catalog.indexingEnabled = true;
  catalog.canonicalUrl =
    'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-professiyam-i-dolzhnostyam/';
  const section = before.sections.find(x => x.code === 'P02');
  section.status = 'published';
  section.seoTitle = 'Редакторский заголовок';
  const tag = before.tags.find(x => x.code === 'T03');
  tag.status = 'published';
  tag.indexingEnabled = true;
  tag.seoDescription = 'Редакторское описание';
  const custom = {
    ...structuredClone(tag),
    code: 'CUSTOM_TAG',
    slug: 'custom-tag',
    name: 'Авторский тег',
  };
  before.tags.push(custom);
  const { after } = buildInstructionTaxonomyPublication(before);
  assert.equal(after.catalogs.find(x => x.code === 'H01').indexingEnabled, true);
  assert.equal(
    after.catalogs.find(x => x.code === 'H01').canonicalUrl,
    'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-professiyam/',
  );
  assert.equal(after.sections.find(x => x.code === 'P02').seoTitle, section.seoTitle);
  assert.deepEqual(
    after.tags.find(x => x.code === 'T03'),
    tag,
  );
  assert.deepEqual(
    after.tags.find(x => x.code === 'CUSTOM_TAG'),
    custom,
  );
  assert.equal(after.redirects.length, 2);
  assert.ok(
    after.redirects.some(
      x => x.code === 'P02' && x.fromPath.includes('po-professiyam-i-dolzhnostyam'),
    ),
  );
  const incomplete = structuredClone(before);
  incomplete.tags = incomplete.tags.filter(x => x.code !== 'T79');
  assert.ok(buildInstructionTaxonomyPublication(incomplete).after.tags.some(x => x.code === 'T79'));
  const moved = structuredClone(before);
  moved.sections[0].parentCode = 'H02';
  assert.throws(() => buildInstructionTaxonomyPublication(moved), {
    code: 'TAXONOMY_PUBLICATION_CONFLICT',
  });
});

test('apply and rollback modify only the registry, keep revisions monotonic and reject edited plans or stale state', t => {
  const { root, repository } = fixture(t);
  const instruction = path.join(root, 'instruction.json');
  fs.writeFileSync(instruction, Buffer.from([0, 255, 15, 26]));
  const bytes = fs.readFileSync(instruction);
  const before = repository.read();
  const plan = buildInstructionTaxonomyPublication(before);
  const tampered = structuredClone(plan);
  tampered.after.tags[0].indexingEnabled = true;
  assert.throws(() => applyInstructionTaxonomyPublication(repository, tampered), {
    code: 'TAXONOMY_PUBLICATION_CONFLICT',
  });
  const after = applyInstructionTaxonomyPublication(repository, plan);
  assert.equal(after.revision, before.revision + 1);
  assert.throws(() => applyInstructionTaxonomyPublication(repository, plan), {
    code: 'TAXONOMY_PUBLICATION_CONFLICT',
  });
  const restored = applyInstructionTaxonomyPublication(repository, plan, { rollback: true });
  assert.deepEqual({ ...restored, revision: before.revision }, before);
  assert.equal(restored.revision, after.revision + 1);
  assert.deepEqual(fs.readFileSync(instruction), bytes);
  const nextPlan = buildInstructionTaxonomyPublication(restored);
  applyInstructionTaxonomyPublication(repository, nextPlan);
  repository.update(state => ({ ...state, root: { ...state.root, seoTitle: 'Поздняя правка' } }), {
    expectedRevision: nextPlan.after.revision,
  });
  assert.throws(
    () => applyInstructionTaxonomyPublication(repository, nextPlan, { rollback: true }),
    { code: 'TAXONOMY_PUBLICATION_CONFLICT' },
  );
});

test('the CLI previews without source writes and requires stopped writers for apply and rollback', t => {
  const { root, file } = fixture(t);
  t.mock.method(console, 'log', () => {});
  const output = path.join(root, 'preview');
  const result = publishInstructionTaxonomy(['--file', file, '--output-dir', output]);
  assert.equal(result.urls, 134);
  assert.equal(result.writesToSource, false);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(file + '.lock'), false);
  const planFile = path.join(output, 'publication.json');
  assert.throws(
    () => publishInstructionTaxonomy(['--file', file, '--apply-plan', planFile]),
    /writers-stopped/u,
  );
  const applied = publishInstructionTaxonomy([
    '--file',
    file,
    '--apply-plan',
    planFile,
    '--writers-stopped',
  ]);
  assert.equal(applied.instructionWrites, 0);
  const rollback = publishInstructionTaxonomy([
    '--file',
    file,
    '--rollback-plan',
    planFile,
    '--writers-stopped',
  ]);
  assert.equal(rollback.status, 'rolled-back');
  assert.throws(
    () =>
      publishInstructionTaxonomy([
        '--file',
        file,
        '--output-dir',
        path.join(path.dirname(file), 'invalid'),
      ]),
    /outside/u,
  );
});
