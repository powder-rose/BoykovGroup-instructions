import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { InstructionsRepository } from '../src/services/instructionsRepository.js';

function record(id, overrides = {}) {
  return {
    id,
    slug: `instruction-${id}-MiXeD`,
    slugAliases: [`old-${id}`],
    title: `Инструкция ${id}`,
    profession: 'Электрик',
    source: 'manual',
    status: 'published',
    seoStatus: 'noindex',
    revision: 3,
    primaryCategoryId: 'W01',
    tagIds: ['T47', 'T48'],
    publishedAt: '2026-01-01',
    createdAt: '2025-12-01',
    updatedAt: '2026-02-01',
    modifiedAt: '2026-02-02',
    generatedAt: '2025-11-01',
    uploadedAt: '2025-11-02',
    instructionContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'PRIVATE_BODY'.repeat(800) }] },
      ],
    },
    editorialMeta: { seoAuthor: 'PRIVATE_AUTHOR' },
    taxonomyMeta: { source: 'PRIVATE_CLASSIFICATION_PROVENANCE' },
    ...overrides,
  };
}

function fixture(t, records = [record('one'), record('two')]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-public-index-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = item =>
    fs.writeFileSync(path.join(directory, `${item.id}.json`), JSON.stringify(item, null, 2));
  records.forEach(write);
  const repository = new InstructionsRepository(directory);
  return { directory, repository, write, file: id => path.join(directory, `${id}.json`) };
}

function countBodyReads(t) {
  const original = fs.readFileSync;
  let count = 0;
  t.mock.method(fs, 'readFileSync', function (file, ...options) {
    if (typeof file === 'number') count += 1;
    return original.call(this, file, ...options);
  });
  return () => count;
}

function assertStorageError(action) {
  assert.throws(
    action,
    error => error.code === 'INSTRUCTION_STORAGE_ERROR' && error.status === 500,
  );
}

test('public references build once and keep warm reads free of full JSON bodies', t => {
  const records = Array.from({ length: 128 }, (_, index) => record(`document-${index}`));
  const f = fixture(t, records);
  const reads = countBodyReads(t);
  const references = f.repository.getPublicReferencesFresh();
  assert.equal(reads(), records.length);
  assert.equal(references.length, records.length);
  assert.ok(references.every(item => item.profession === 'Электрик'));
  assert.ok(references.every(item => item.revision === 3));
  for (const field of [
    'publishedAt',
    'createdAt',
    'updatedAt',
    'modifiedAt',
    'generatedAt',
    'uploadedAt',
  ]) {
    assert.equal(references[0][field], records[0][field]);
  }
  for (const privateField of ['instructionContent', 'editorialMeta', 'taxonomyMeta']) {
    assert.equal(Object.hasOwn(references[0], privateField), false);
  }
  assert.equal(JSON.stringify(references).includes('PRIVATE_'), false);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(f.repository.getPublicReferencesFresh().length, records.length);
  }
  assert.equal(reads(), records.length);
});

test('returned references cannot mutate index entries, aliases, tags or cached full records', t => {
  const f = fixture(t);
  const before = structuredClone(f.repository.getById('one'));
  const first = f.repository.getPublicReferencesFresh();
  const item = first.find(reference => reference.id === 'one');
  item.title = 'Изменено снаружи';
  item.tagIds.push('T01');
  item.slugAliases[0] = 'foreign-alias';
  first.pop();
  const next = f.repository.getPublicReferencesFresh();
  assert.equal(next.length, 2);
  assert.equal(next.find(reference => reference.id === 'one').title, before.title);
  assert.deepEqual(next.find(reference => reference.id === 'one').tagIds, before.tagIds);
  assert.deepEqual(next.find(reference => reference.id === 'one').slugAliases, before.slugAliases);
  assert.deepEqual(f.repository.getById('one'), before);
});

test('offline same-size edits with restored mtime, atomic replacement, additions and removals refresh only changed files', t => {
  const f = fixture(t, [record('one', { title: 'Before' }), record('two')]);
  const fixedTime = new Date('2026-01-01T00:00:00.000Z');
  fs.utimesSync(f.file('one'), fixedTime, fixedTime);
  f.repository.getPublicReferencesFresh();
  const before = fs.statSync(f.file('one'), { bigint: true });
  const reads = countBodyReads(t);

  f.write(record('one', { title: 'After!' }));
  fs.utimesSync(f.file('one'), fixedTime, fixedTime);
  const after = fs.statSync(f.file('one'), { bigint: true });
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.notEqual(after.ctimeNs, before.ctimeNs);
  let references = f.repository.getPublicReferencesFresh();
  assert.equal(reads(), 1);
  assert.equal(references.find(item => item.id === 'one').title, 'After!');
  assert.equal(f.repository.getById('one').title, 'After!');

  const replacement = path.join(f.directory, 'replacement.tmp');
  fs.writeFileSync(replacement, JSON.stringify(record('two', { slug: 'new-second-slug' })));
  fs.renameSync(replacement, f.file('two'));
  references = f.repository.getPublicReferencesFresh();
  assert.equal(reads(), 2);
  assert.equal(references.find(item => item.id === 'two').slug, 'new-second-slug');
  assert.equal(f.repository.getBySlug('new-second-slug').id, 'two');

  f.write(record('three'));
  references = f.repository.getPublicReferencesFresh();
  assert.equal(reads(), 3);
  assert.equal(references.length, 3);
  fs.unlinkSync(f.file('one'));
  references = f.repository.getPublicReferencesFresh();
  assert.equal(reads(), 3);
  assert.equal(references.length, 2);
  assert.equal(f.repository.getById('one'), null);
});

test('repository saves and removals update public references while reload and strong snapshots retain complete bodies', t => {
  const f = fixture(t);
  f.repository.getPublicReferencesFresh();
  const reads = countBodyReads(t);
  const changed = record('one', { title: 'Сохранённая новая версия', revision: 4 });
  f.repository.save(changed);
  assert.equal(f.repository.getPublicReferencesFresh().find(item => item.id === 'one').revision, 4);
  assert.equal(reads(), 1);
  f.repository.remove('two');
  assert.equal(f.repository.getPublicReferencesFresh().length, 1);
  assert.equal(reads(), 1);

  const strong = f.repository.getAllFreshSnapshots();
  assert.equal(reads(), 2);
  assert.deepEqual(strong[0].record.instructionContent, changed.instructionContent);
  assert.ok(Buffer.isBuffer(strong[0].bytes));
  assert.deepEqual(JSON.parse(strong[0].bytes.toString('utf8')), changed);
  f.repository.getAllFreshSnapshots();
  assert.equal(reads(), 3);
  f.repository.reload();
  const beforeIndexRead = reads();
  assert.equal(f.repository.getPublicReferencesFresh()[0].title, changed.title);
  assert.equal(reads() - beforeIndexRead, 1);
});

test('a malformed later record never partially commits changed references or full cache and recovery retries cleanly', t => {
  const f = fixture(t, [record('a'), record('z')]);
  const references = f.repository.getPublicReferencesFresh();
  const cachedA = f.repository.getById('a');
  const cachedZ = f.repository.getById('z');
  f.write(record('a', { title: 'Новая версия a' }));
  fs.writeFileSync(f.file('z'), '{broken');
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  assert.equal(f.repository.getById('a'), cachedA);
  assert.equal(f.repository.getById('z'), cachedZ);
  assert.equal(references.find(item => item.id === 'a').title, 'Инструкция a');
  f.write(record('z', { title: 'Исправленная версия z' }));
  const repaired = f.repository.getPublicReferencesFresh();
  assert.equal(repaired.find(item => item.id === 'a').title, 'Новая версия a');
  assert.equal(repaired.find(item => item.id === 'z').title, 'Исправленная версия z');
});

test('new invalid UTF-8, filename IDs and assignment fields fail closed without replacing a valid cached record', t => {
  const f = fixture(t, [record('one')]);
  f.repository.getPublicReferencesFresh();
  const original = f.repository.getById('one');
  for (const invalid of [
    Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d]),
    JSON.stringify(record('other-id')),
    JSON.stringify(record('one', { id: '../unsafe' })),
    JSON.stringify(record('one', { tagIds: 'T47' })),
  ]) {
    fs.writeFileSync(f.file('one'), invalid);
    assertStorageError(() => f.repository.getPublicReferencesFresh());
    assert.equal(f.repository.getById('one'), original);
  }
  f.write(record('one'));
  assert.equal(f.repository.getPublicReferencesFresh()[0].id, 'one');
});

test('nonregular JSON entries and symbolic links are rejected on every refresh', t => {
  const f = fixture(t, [record('one')]);
  f.repository.getPublicReferencesFresh();
  const directoryEntry = path.join(f.directory, 'directory.json');
  fs.mkdirSync(directoryEntry);
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  fs.rmdirSync(directoryEntry);
  const link = path.join(f.directory, 'linked.json');
  const target = process.platform === 'win32' ? path.join(f.directory, 'target') : f.file('one');
  if (process.platform === 'win32') fs.mkdirSync(target);
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'file');
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  fs.rmSync(link, { recursive: true });
  assert.equal(f.repository.getPublicReferencesFresh().length, 1);
});

test('missing or linked storage directories never serve cached references or recreate storage', t => {
  const f = fixture(t, [record('one')]);
  f.repository.getPublicReferencesFresh();
  const cached = f.repository.getById('one');
  const moved = `${f.directory}-moved`;
  t.after(() => fs.rmSync(moved, { recursive: true, force: true }));
  fs.renameSync(f.directory, moved);
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  assert.equal(fs.existsSync(f.directory), false);
  assert.equal(f.repository.getById('one'), cached);
  fs.symlinkSync(moved, f.directory, process.platform === 'win32' ? 'junction' : 'dir');
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  fs.rmSync(f.directory, { recursive: true });
  fs.renameSync(moved, f.directory);
  assert.equal(f.repository.getPublicReferencesFresh()[0].id, 'one');
});

test('an in-place file change during strict reading is rejected before any cache commit', t => {
  const f = fixture(t, [record('one')]);
  f.repository.getPublicReferencesFresh();
  const cached = f.repository.getById('one');
  f.write(record('one', { title: 'Первая внешняя версия' }));
  const originalRead = fs.readFileSync;
  let changed = false;
  const read = t.mock.method(fs, 'readFileSync', function (file, ...options) {
    const bytes = originalRead.call(this, file, ...options);
    if (typeof file === 'number' && !changed) {
      changed = true;
      f.write(record('one', { title: 'Вторая внешняя версия' }));
    }
    return bytes;
  });
  assertStorageError(() => f.repository.getPublicReferencesFresh());
  assert.equal(changed, true);
  assert.equal(f.repository.getById('one'), cached);
  read.mock.restore();
  assert.equal(f.repository.getPublicReferencesFresh()[0].title, 'Вторая внешняя версия');
});

test('public indexing leaves source bytes, modification times and non-JSON maintenance files unchanged', t => {
  const f = fixture(t);
  const ignored = path.join(f.directory, 'maintenance.json.tmp');
  fs.writeFileSync(ignored, 'not a completed instruction');
  const paths = [f.file('one'), f.file('two'), ignored];
  const before = paths.map(file => ({
    bytes: fs.readFileSync(file),
    mtimeNs: fs.statSync(file, { bigint: true }).mtimeNs,
  }));
  f.repository.getPublicReferencesFresh();
  f.repository.getPublicReferencesFresh();
  paths.forEach((file, index) => {
    assert.deepEqual(fs.readFileSync(file), before[index].bytes);
    assert.equal(fs.statSync(file, { bigint: true }).mtimeNs, before[index].mtimeNs);
  });
  assert.deepEqual(fs.readdirSync(f.directory).sort(), [
    'maintenance.json.tmp',
    'one.json',
    'two.json',
  ]);
});
