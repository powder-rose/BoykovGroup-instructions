import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { acquireFileLeaseLock, releaseFileLeaseLock } from '../src/utils/fileLeaseLock.js';
import { normalizeInstructionTaxonomyEntity } from '../src/services/instructionTaxonomyRegistryModel.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';

function seedState() {
  return {
    schemaVersion: 1,
    revision: 0,
    root: normalizeInstructionTaxonomyEntity('root', {
      code: 'ROOT',
      name: 'Инструкции по охране труда',
      slug: 'instrukcii-po-ohrane-truda',
      parentCode: null,
    }),
    catalogs: [
      normalizeInstructionTaxonomyEntity('catalog', {
        code: 'H02',
        name: 'По видам работ',
        slug: 'po-vidam-rabot',
        parentCode: 'ROOT',
        routeApproved: true,
      }),
    ],
    sections: [
      normalizeInstructionTaxonomyEntity('section', {
        code: 'W01',
        name: 'Работы на высоте',
        slug: 'raboty-na-vysote',
        parentCode: 'H02',
      }),
    ],
    tags: [],
    redirects: [],
    sourceIssues: [],
  };
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-registry-'));
  const filePath = path.join(root, 'runtime', 'instruction-taxonomy.json');
  const seed = seedState();
  const create = () => createInstructionTaxonomyRegistryRepository({ filePath, seed });
  const repository = create();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, filePath, seed, repository, create };
}

function renameSection(repository, name, expectedRevision = repository.read().revision) {
  return repository.update(
    state => {
      state.sections[0].name = name;
      return state;
    },
    { expectedRevision },
  );
}

function assertNoTemporaryFiles(f) {
  assert.deepEqual(fs.readdirSync(path.dirname(f.filePath)), ['instruction-taxonomy.json']);
}

test('missing storage reads a private seed copy without creating any runtime directory', t => {
  const f = fixture(t);
  const first = f.repository.read();
  first.sections[0].name = 'Изменение возвращённой копии';
  f.seed.sections[0].name = 'Изменение переданного seed';
  assert.equal(f.repository.read().sections[0].name, 'Работы на высоте');
  assert.deepEqual(fs.readdirSync(f.root), []);
});

test('updates survive restart and return detached state with repository-owned revisions', t => {
  const f = fixture(t);
  const updated = f.repository.update(
    state => {
      state.sections[0].name = 'Проверенный раздел';
      state.revision = 999;
      return state;
    },
    { expectedRevision: 0 },
  );
  assert.equal(updated.revision, 1);
  updated.sections[0].name = 'Нельзя изменить сохранённую копию';
  assert.equal(f.create().read().sections[0].name, 'Проверенный раздел');
  assert.equal(f.create().read().revision, 1);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(f.filePath).mode & 0o777, 0o600);
  }
  assertNoTemporaryFiles(f);
});

test('two repository instances see fresh writes and a stale revision never overwrites them', t => {
  const f = fixture(t);
  const second = f.create();
  renameSection(f.repository, 'Первая правка', 0);
  assert.equal(second.read().sections[0].name, 'Первая правка');
  const original = fs.readFileSync(f.filePath);
  assert.throws(() => renameSection(second, 'Устаревшая правка', 0), {
    code: 'TAXONOMY_REVISION_CONFLICT',
    status: 409,
  });
  assert.deepEqual(fs.readFileSync(f.filePath), original);
  renameSection(second, 'Актуальная правка', 1);
  assert.equal(f.repository.read().sections[0].name, 'Актуальная правка');
  assert.equal(f.repository.read().revision, 2);
  assertNoTemporaryFiles(f);
});

test('invalid revisions fail before creating runtime storage or a lock', t => {
  const f = fixture(t);
  for (const expectedRevision of [undefined, null, -1, 0.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => f.repository.update(state => state, { expectedRevision }), {
      code: 'INVALID_TAXONOMY_REVISION',
      status: 400,
    });
  }
  assert.deepEqual(fs.readdirSync(f.root), []);
});

test('invalid mutations leave the last valid storage untouched and release the lock', t => {
  const f = fixture(t);
  renameSection(f.repository, 'Сохранённый раздел');
  const original = fs.readFileSync(f.filePath);
  assert.throws(() =>
    f.repository.update(
      state => ({ ...state, sections: [{ ...state.sections[0], parentCode: 'UNKNOWN' }] }),
      { expectedRevision: 1 },
    ),
  );
  for (const value of [undefined, null, [], Promise.resolve({})]) {
    assert.throws(() => f.repository.update(() => value, { expectedRevision: 1 }), {
      code: 'INVALID_TAXONOMY_UPDATE',
    });
  }
  assert.deepEqual(fs.readFileSync(f.filePath), original);
  assertNoTemporaryFiles(f);
});

test('malformed JSON, invalid states and invalid UTF-8 are never replaced with the seed', t => {
  const f = fixture(t);
  fs.mkdirSync(path.dirname(f.filePath));
  for (const bytes of [
    Buffer.from('{broken'),
    Buffer.from(JSON.stringify({ ...f.seed, sections: null })),
    Buffer.from([0xff, 0xfe]),
  ]) {
    fs.writeFileSync(f.filePath, bytes);
    assert.throws(() => f.repository.read(), { code: 'TAXONOMY_STORAGE_ERROR', status: 500 });
    assert.throws(() => renameSection(f.repository, 'Не сохранять', 0), {
      code: 'TAXONOMY_STORAGE_ERROR',
    });
    assert.deepEqual(fs.readFileSync(f.filePath), bytes);
    assertNoTemporaryFiles(f);
  }
});

test('a non-regular storage entry is an error rather than an empty registry', t => {
  const f = fixture(t);
  fs.mkdirSync(f.filePath, { recursive: true });
  assert.throws(() => f.repository.read(), { code: 'TAXONOMY_STORAGE_ERROR' });
  assert.equal(fs.statSync(f.filePath).isDirectory(), true);
});

test('an active update lock prevents another writer without creating the registry', t => {
  const f = fixture(t);
  const lock = acquireFileLeaseLock({ filePath: `${f.filePath}.lock`, staleMs: 30_000 });
  try {
    assert.throws(() => renameSection(f.repository, 'Конкурирующая запись', 0), {
      code: 'TAXONOMY_LOCKED',
      status: 409,
    });
    assert.equal(fs.existsSync(f.filePath), false);
  } finally {
    releaseFileLeaseLock(lock);
  }
});

test('a regular-file flush failure preserves the previous bytes and cleans its temporary file', t => {
  const f = fixture(t);
  renameSection(f.repository, 'Сохранённый раздел');
  const originalBytes = fs.readFileSync(f.filePath);
  const originalOpen = fs.openSync;
  const originalSync = fs.fsyncSync;
  let temporaryFd;
  let injected = false;
  t.mock.method(fs, 'openSync', (file, ...args) => {
    const fd = originalOpen(file, ...args);
    if (typeof file === 'string' && file.endsWith('.tmp')) temporaryFd = fd;
    return fd;
  });
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fd === temporaryFd) {
      injected = true;
      throw Object.assign(new Error('Simulated regular-file flush failure'), { code: 'EIO' });
    }
    return originalSync(fd);
  });
  assert.throws(() => renameSection(f.repository, 'Не сохранять', 1), {
    code: 'TAXONOMY_STORAGE_ERROR',
  });
  assert.equal(injected, true);
  assert.deepEqual(fs.readFileSync(f.filePath), originalBytes);
  assert.equal(f.repository.read().revision, 1);
  assertNoTemporaryFiles(f);
});

test('a replacement failure preserves the previous bytes and cleans its temporary file', t => {
  const f = fixture(t);
  renameSection(f.repository, 'Сохранённый раздел');
  const originalBytes = fs.readFileSync(f.filePath);
  t.mock.method(fs, 'renameSync', () => {
    throw Object.assign(new Error('Simulated atomic replacement failure'), { code: 'EIO' });
  });
  assert.throws(() => renameSection(f.repository, 'Не сохранять', 1), {
    code: 'TAXONOMY_STORAGE_ERROR',
  });
  assert.deepEqual(fs.readFileSync(f.filePath), originalBytes);
  assert.equal(f.repository.read().revision, 1);
  assertNoTemporaryFiles(f);
});

test('losing a lock during mutation cannot commit a new state or remove the next owner lock', t => {
  const f = fixture(t);
  renameSection(f.repository, 'Сохранённый раздел');
  const original = fs.readFileSync(f.filePath);
  const replacementLock = { owner: 'another-writer', pid: process.pid };
  assert.throws(
    () =>
      f.repository.update(
        state => {
          fs.writeFileSync(`${f.filePath}.lock`, JSON.stringify(replacementLock));
          state.sections[0].name = 'Не сохранять';
          return state;
        },
        { expectedRevision: 1 },
      ),
    { code: 'TAXONOMY_LOCK_LOST', status: 409 },
  );
  assert.deepEqual(fs.readFileSync(f.filePath), original);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${f.filePath}.lock`, 'utf8')), replacementLock);
});
