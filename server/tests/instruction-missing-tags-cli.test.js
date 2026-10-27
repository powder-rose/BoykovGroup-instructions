import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getInstructionDocument } from '../src/shared/instructionDocument.js';
import {
  previewMissingInstructionTags,
  applyMissingInstructionTags,
  recoverMissingInstructionTags,
} from '../src/services/instructionMissingTagsService.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';

const hash = value => createHash('sha256').update(value).digest('hex');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-missing-tags-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceRoot = path.join(directory, 'source');
  const published = path.join(sourceRoot, 'server/src/data/instructions');
  const drafts = path.join(sourceRoot, 'server/src/data/instruction-drafts');
  fs.mkdirSync(published, { recursive: true });
  fs.mkdirSync(drafts);
  fs.mkdirSync(path.join(sourceRoot, 'server/data'));
  const records = [
    {
      id: 'z-empty',
      slug: 'empty-Z',
      title: 'Бухгалтер',
      primaryCategoryId: null,
      tagIds: [],
      revision: 3,
      intro: 'Текст Ω',
      taxonomyMeta: { needsReview: true },
    },
    {
      id: 'a-empty',
      slug: 'empty-A',
      title: 'Юрист',
      primaryCategoryId: 'electrical',
      revision: 7,
      sections: [{ heading: 'Текст', paragraphs: ['Сохранить документ'] }],
    },
    {
      id: 'tagged',
      slug: 'tagged',
      title: 'Уже с тегами',
      primaryCategoryId: 'P01',
      tagIds: ['T21'],
      revision: 2,
    },
  ];
  for (const record of records)
    fs.writeFileSync(path.join(published, `${record.id}.json`), JSON.stringify(record));
  const draftFile = path.join(drafts, `${Buffer.from('z-empty').toString('base64url')}.json`);
  fs.writeFileSync(draftFile, JSON.stringify({ ...records[0], status: 'draft', tagIds: ['T19'] }));
  const bundle = {
    schemaVersion: 1,
    sourceCsvSha256: 'a'.repeat(64),
    tags: [{ code: 'T80', name: 'Юристы', slug: 'yuristy' }],
    assignments: records.map(record => ({
      id: record.id,
      url: `https://boykovdocs.ru/instrukciya-po-ohrane-truda/${record.slug}`,
      title: record.title,
      primaryCategoryId: record.primaryCategoryId,
      documentSha256: hash(JSON.stringify(getInstructionDocument(record))),
      tagIds: [record.id === 'a-empty' ? 'T80' : 'T02'],
    })),
  };
  const bundleFile = path.join(directory, 'bundle.json');
  const saveBundle = () => fs.writeFileSync(bundleFile, JSON.stringify(bundle));
  saveBundle();
  const outputDirectory = path.join(directory, 'preview');
  const bytes = () => {
    const result = {};
    function scan(directory) {
      for (const name of fs.readdirSync(directory)) {
        const file = path.join(directory, name);
        if (fs.lstatSync(file).isDirectory()) scan(file);
        else result[path.relative(sourceRoot, file)] = fs.readFileSync(file).toString('base64');
      }
    }
    scan(sourceRoot);
    return result;
  };
  const preview = () => previewMissingInstructionTags({ sourceRoot, bundleFile, outputDirectory });
  const apply = () =>
    applyMissingInstructionTags({
      sourceRoot,
      previewDirectory: outputDirectory,
      writersStopped: true,
    });
  return {
    directory,
    sourceRoot,
    published,
    draftFile,
    bundle,
    bundleFile,
    saveBundle,
    outputDirectory,
    bytes,
    preview,
    apply,
  };
}

test('offline preview is read-only and apply is journaled, guarded and idempotent', t => {
  const f = fixture(t);
  const before = f.bytes();
  const report = f.preview();
  assert.equal(report.writesToSource, false);
  assert.equal(report.changedDocuments, 2);
  assert.equal(report.updatedVersions, 2);
  assert.equal(report.newTags, 1);
  assert.equal(report.skipped, 1);
  assert.deepEqual(f.bytes(), before);
  assert.throws(
    () =>
      applyMissingInstructionTags({
        sourceRoot: f.sourceRoot,
        previewDirectory: f.outputDirectory,
      }),
    /Stop every source writer/u,
  );
  assert.deepEqual(f.bytes(), before);
  const result = f.apply();
  assert.equal(result.status, 'committed');
  assert.deepEqual(f.apply(), result);
  const after = f.bytes();
  assert.equal(
    after['server/src/data/instruction-drafts/ei1lbXB0eQ.json'],
    before['server/src/data/instruction-drafts/ei1lbXB0eQ.json'],
  );
  assert.equal(
    after['server/src/data/instructions/tagged.json'],
    before['server/src/data/instructions/tagged.json'],
  );
  const record = JSON.parse(fs.readFileSync(path.join(f.published, 'z-empty.json')));
  assert.equal(record.primaryCategoryId, null);
  assert.equal(record.intro, 'Текст Ω');
  assert.equal(record.taxonomyMeta.needsReview, true);
  const registry = createInstructionTaxonomyRegistryRepository({
    filePath: path.join(f.sourceRoot, 'server/data/instruction-taxonomy.json'),
  }).read();
  assert.equal(registry.tags.find(tag => tag.code === 'T80').indexingEnabled, false);
  assert.equal(registry.tags.find(tag => tag.code === 'T80').status, 'published');
  const markerFile = path.join(
    f.sourceRoot,
    'server/data/instruction-taxonomy-operations/active.json',
  );
  fs.writeFileSync(
    markerFile,
    JSON.stringify({
      schemaVersion: 1,
      operationId: result.operationId,
      kind: 'apply',
      startedAt: new Date().toISOString(),
    }),
  );
  assert.deepEqual(
    recoverMissingInstructionTags({
      sourceRoot: f.sourceRoot,
      operationId: result.operationId,
      writersStopped: true,
    }),
    result,
  );
  assert.equal(fs.existsSync(markerFile), false);
});

test('any changed document, draft, selection or registry invalidates the reviewed preview before writes', t => {
  for (const change of ['body', 'draft', 'tags', 'registry']) {
    const f = fixture(t);
    f.preview();
    if (change === 'body' || change === 'tags') {
      const file = path.join(f.published, 'a-empty.json');
      const record = JSON.parse(fs.readFileSync(file));
      if (change === 'body') record.intro = 'Changed';
      else record.tagIds = ['T21'];
      fs.writeFileSync(file, JSON.stringify(record));
    } else if (change === 'draft') fs.appendFileSync(f.draftFile, ' ');
    else
      createInstructionTaxonomyRegistryRepository({
        filePath: path.join(f.sourceRoot, 'server/data/instruction-taxonomy.json'),
      }).update(state => state, { expectedRevision: 0 });
    const beforeApply = f.bytes();
    assert.throws(f.apply, /differs|changed/u, change);
    assert.deepEqual(f.bytes(), beforeApply, change);
  }
});

test('collisions, unknown tags and duplicate records fail without writing to source', t => {
  for (const change of ['collision', 'unknown', 'duplicate', 'inside-source']) {
    const f = fixture(t);
    if (change === 'collision') f.bundle.tags[0].code = 'T02';
    if (change === 'unknown') f.bundle.assignments[0].tagIds = ['T_UNKNOWN'];
    if (change === 'duplicate') f.bundle.assignments.push(f.bundle.assignments[0]);
    f.saveBundle();
    const before = f.bytes();
    assert.throws(() =>
      change === 'inside-source'
        ? previewMissingInstructionTags({
            sourceRoot: f.sourceRoot,
            bundleFile: f.bundleFile,
            outputDirectory: path.join(f.sourceRoot, 'preview'),
          })
        : f.preview(),
    );
    assert.deepEqual(f.bytes(), before);
  }
});

test('CLI help and invalid apply flags do not start application services', () => {
  const script = fileURLToPath(
    new URL('../scripts/fillMissingInstructionTags.js', import.meta.url),
  );
  const help = execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.match(help, /read-only preview/u);
  assert.throws(() =>
    execFileSync(process.execPath, [script, '--source-root', '.', '--apply-preview', '.'], {
      stdio: 'pipe',
    }),
  );
});

test('offline service imports do not initialize the application instruction repository', () => {
  const module = new URL('../src/services/instructionMissingTagsService.js', import.meta.url).href;
  const script = `
    import fs from 'node:fs';
    fs.readdirSync = () => { throw new Error('Application cache must not be loaded'); };
    fs.mkdirSync = () => { throw new Error('No directory may be created during import'); };
    await import(${JSON.stringify(module)});
  `;
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], { stdio: 'pipe' });
});
