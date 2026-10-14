import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const utilityPath = path.join(serverRoot, 'src', 'utils', 'asyncFileWriter.js');

function createSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-async-writes-'));
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');
}

async function loadUtility() {
  return import(pathToFileURL(utilityPath).href);
}

test(
  'buffered appender persists queued events in order and flush waits for disk',
  {
    concurrency: false,
  },

  async () => {
    const root = createSandbox();

    const filePath = path.join(root, 'events.jsonl');

    try {
      const { createBufferedFileAppender } = await loadUtility();

      const writer = createBufferedFileAppender({
        filePath,

        label: 'test-events',
      });

      /*
       * Hot path only enqueues.
       * Callers do not await filesystem IO.
       */
      assert.equal(writer.append('{"event":1}\n'), undefined);

      assert.equal(writer.append('{"event":2}\n'), undefined);

      await writer.flush();

      assert.equal(fs.readFileSync(filePath, 'utf8'), '{"event":1}\n{"event":2}\n');
    } finally {
      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'latest atomic JSON writer coalesces hot-path state and flushes the newest snapshot',
  {
    concurrency: false,
  },

  async () => {
    const root = createSandbox();

    const filePath = path.join(root, 'views.json');

    try {
      const { createLatestAtomicJsonWriter } = await loadUtility();

      const writer = createLatestAtomicJsonWriter({
        filePath,

        label: 'test-views',
      });

      writer.write({
        total: 1,
      });

      writer.write({
        total: 2,
      });

      writer.write({
        total: 3,
      });

      await writer.flush();

      const stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      assert.deepEqual(stored, {
        total: 3,
      });

      const leftovers = fs.readdirSync(root).filter(name => name.includes('.tmp'));

      assert.deepEqual(leftovers, [], 'atomic writer must not leave temp files after flush');
    } finally {
      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }
  },
);

const hotPathContracts = [
  {
    name: 'visitor page-view analytics',

    path: 'src/services/visitorStatsService.js',

    required: 'createBufferedFileAppender',

    forbidden: ['appendFileSync', 'writeFileSync'],
  },

  {
    name: 'PDF download analytics',

    path: 'src/services/downloadStatsService.js',

    required: 'createBufferedFileAppender',

    forbidden: ['appendFileSync', 'writeFileSync'],
  },

  {
    name: 'generation usage analytics',

    path: 'src/services/generationUsageService.js',

    required: 'createBufferedFileAppender',

    forbidden: ['appendFileSync', 'writeFileSync'],
  },

  {
    name: 'instruction view analytics',

    path: 'src/services/instructionViewService.js',

    required: 'createLatestAtomicJsonWriter',

    forbidden: ['writeFileSync', 'renameSync'],
  },
];

for (const contract of hotPathContracts) {
  test(`${contract.name} does not synchronously write to disk`, () => {
    const source = readSource(contract.path);

    assert.match(
      source,
      new RegExp(contract.required, 'u'),
      `${contract.name} must use the async writer`,
    );

    for (const forbidden of contract.forbidden) {
      assert.doesNotMatch(
        source,
        new RegExp(forbidden, 'u'),
        `${contract.name} still contains synchronous filesystem writes`,
      );
    }
  });
}

test('server flushes queued asynchronous writes after graceful shutdown work completes', () => {
  const source = readSource('src/index.js');

  assert.match(
    source,
    /flushAsyncFileWrites/u,
    'server entrypoint must import the async writer flush',
  );

  assert.match(
    source,
    /await\s+shutdown\(signal\)[\s\S]*await\s+flushAsyncFileWrites\(\)/u,
    'analytics must flush after HTTP and background shutdown work finishes',
  );
});
