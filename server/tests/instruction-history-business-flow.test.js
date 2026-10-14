import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const sourceRoot = path.join(serverRoot, 'src');

const TEST_JWT_SECRET = 'boykovdocs-instruction-history-business-flow-jwt-secret-2026';

function emptyDirectory(directory) {
  fs.rmSync(directory, {
    recursive: true,
    force: true,
  });

  fs.mkdirSync(directory, {
    recursive: true,
  });
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);

    server.once('error', reject);
  });

  return server;
}

async function closeServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createIsolatedHistoryFlow() {
  const root = fs.mkdtempSync(path.join(serverRoot, 'boykovdocs-instruction-history-flow-'));

  const sandboxSrc = path.join(root, 'src');

  fs.cpSync(sourceRoot, sandboxSrc, {
    recursive: true,
  });

  const instructionsDirectory = path.join(sandboxSrc, 'data', 'instructions');

  const historyDirectory = path.join(sandboxSrc, 'data', 'instruction-history');

  emptyDirectory(instructionsDirectory);

  emptyDirectory(historyDirectory);

  /*
   * Некоторые imports роутера используют
   * прочие data-файлы, но сами тесты их
   * не изменяют. Все они также находятся
   * внутри sandbox-копии src.
   */
  const previousJwtSecret = process.env.JWT_SECRET;

  process.env.JWT_SECRET = TEST_JWT_SECRET;

  let server = null;

  try {
    const moduleUrl = relativePath => pathToFileURL(path.join(sandboxSrc, relativePath)).href;

    const { instructionsRouter } = await import(moduleUrl('routes/instructions.js'));

    const { instructionsRepository } = await import(
      moduleUrl('services/instructionsRepository.js')
    );

    const historyService = await import(moduleUrl('services/instructionHistoryService.js'));

    const { attachUser } = await import(moduleUrl('middleware/auth.js'));

    const { issueAdminToken } = await import(moduleUrl('services/authService.js'));

    const app = express();

    app.use(express.json());

    app.use(attachUser);

    app.use('/api/instructions', instructionsRouter);

    server = await listen(app);

    const address = server.address();

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const adminToken = issueAdminToken();

    return {
      root,
      baseUrl,
      adminToken,
      instructionsDirectory,
      historyDirectory,
      instructionsRepository,
      historyService,

      async request(route, { method = 'GET', body, admin = false } = {}) {
        const headers = {};

        if (body !== undefined) {
          headers['content-type'] = 'application/json';
        }

        if (admin) {
          headers.Authorization = `Bearer ${adminToken}`;
        }

        return fetch(`${baseUrl}${route}`, {
          method,
          headers,

          body: body === undefined ? undefined : JSON.stringify(body),
        });
      },

      async cleanup() {
        try {
          await closeServer(server);
        } finally {
          if (previousJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
          } else {
            process.env.JWT_SECRET = previousJwtSecret;
          }

          fs.rmSync(root, {
            recursive: true,
            force: true,
          });
        }
      },
    };
  } catch (error) {
    try {
      await closeServer(server);
    } finally {
      if (previousJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousJwtSecret;
      }

      fs.rmSync(root, {
        recursive: true,
        force: true,
      });
    }

    throw error;
  }
}

function createInstruction() {
  const now = new Date().toISOString();

  return {
    id: 'instruction-history-business-flow',

    title: 'Инструкция по охране труда — исходная версия',

    profession: 'Тестовый специалист',

    professionKey: 'тестовый специалист',

    intro: 'Исходное содержание инструкции.',

    sections: [
      {
        number: 1,

        heading: 'Общие требования охраны труда',

        paragraphs: ['1.1. Исходный текст инструкции.'],
      },
    ],

    source: 'uploaded',

    version: '1.0',

    createdAt: now,

    updatedAt: now,
  };
}

test(
  'instruction edit history and rollback routes require admin authorization',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedHistoryFlow();

    try {
      const initial = createInstruction();

      flow.instructionsRepository.save(initial);

      const editResponse = await flow.request(`/api/instructions/${initial.id}`, {
        method: 'PUT',

        body: {
          title: 'Несанкционированное изменение',
        },
      });

      assert.equal(editResponse.status, 401);

      const historyResponse = await flow.request(`/api/instructions/${initial.id}/history`);

      assert.equal(historyResponse.status, 401);

      const rollbackResponse = await flow.request(`/api/instructions/${initial.id}/rollback`, {
        method: 'POST',
      });

      assert.equal(rollbackResponse.status, 401);

      const stored = flow.instructionsRepository.getById(initial.id);

      assert.equal(stored.title, initial.title);

      assert.equal(stored.version, '1.0');

      assert.deepEqual(flow.historyService.getInstructionHistoryInfo(initial.id), {
        available: false,

        count: 0,
      });
    } finally {
      await flow.cleanup();
    }
  },
);

test(
  'admin edits build ordered history and rollback restores each committed version',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedHistoryFlow();

    try {
      const initial = createInstruction();

      flow.instructionsRepository.save(initial);

      /*
       * ========================================
       * EDIT #1
       * ========================================
       */
      const editOneResponse = await flow.request(`/api/instructions/${initial.id}`, {
        method: 'PUT',

        admin: true,

        body: {
          /*
           * ID менять нельзя.
           */
          id: 'malicious-new-id',

          title: 'Инструкция по охране труда — редакция один',

          intro: 'Первая редакция документа.',
        },
      });

      assert.equal(editOneResponse.status, 200);

      const editOne = await editOneResponse.json();

      assert.equal(editOne.id, initial.id);

      assert.equal(editOne.title, 'Инструкция по охране труда — редакция один');

      assert.equal(editOne.version, '1.1');

      const historyOneResponse = await flow.request(`/api/instructions/${initial.id}/history`, {
        admin: true,
      });

      assert.equal(historyOneResponse.status, 200);

      assert.deepEqual(await historyOneResponse.json(), {
        available: true,

        count: 1,
      });

      /*
       * Snapshot filename uses milliseconds.
       * Keep the two committed edits on
       * distinct timestamps so this test
       * validates business ordering without
       * relying on random filename suffixes.
       */
      await new Promise(resolve => setTimeout(resolve, 10));

      /*
       * ========================================
       * EDIT #2
       * ========================================
       */
      const editTwoResponse = await flow.request(`/api/instructions/${initial.id}`, {
        method: 'PUT',

        admin: true,

        body: {
          id: 'another-malicious-id',

          title: 'Инструкция по охране труда — редакция два',

          intro: 'Вторая редакция документа.',
        },
      });

      assert.equal(editTwoResponse.status, 200);

      const editTwo = await editTwoResponse.json();

      assert.equal(editTwo.id, initial.id);

      assert.equal(editTwo.version, '1.2');

      assert.equal(editTwo.title, 'Инструкция по охране труда — редакция два');

      const historyTwoResponse = await flow.request(`/api/instructions/${initial.id}/history`, {
        admin: true,
      });

      assert.deepEqual(await historyTwoResponse.json(), {
        available: true,

        count: 2,
      });

      /*
       * Публичный GET видит текущую
       * последнюю committed-версию.
       */
      const currentResponse = await flow.request(`/api/instructions/${initial.id}`);

      assert.equal(currentResponse.status, 200);

      const current = await currentResponse.json();

      assert.equal(current.version, '1.2');

      assert.equal(current.title, 'Инструкция по охране труда — редакция два');

      /*
       * ========================================
       * ROLLBACK #1 -> v1.1
       * ========================================
       */
      const rollbackOneResponse = await flow.request(`/api/instructions/${initial.id}/rollback`, {
        method: 'POST',

        admin: true,
      });

      assert.equal(rollbackOneResponse.status, 200);

      const rollbackOne = await rollbackOneResponse.json();

      assert.equal(rollbackOne.ok, true);

      assert.equal(rollbackOne.instruction.id, initial.id);

      assert.equal(rollbackOne.instruction.version, '1.1');

      assert.equal(rollbackOne.instruction.title, 'Инструкция по охране труда — редакция один');

      const historyAfterOne = await flow.request(`/api/instructions/${initial.id}/history`, {
        admin: true,
      });

      assert.deepEqual(await historyAfterOne.json(), {
        available: true,

        count: 1,
      });

      /*
       * ========================================
       * ROLLBACK #2 -> v1.0
       * ========================================
       */
      const rollbackTwoResponse = await flow.request(`/api/instructions/${initial.id}/rollback`, {
        method: 'POST',

        admin: true,
      });

      assert.equal(rollbackTwoResponse.status, 200);

      const rollbackTwo = await rollbackTwoResponse.json();

      assert.equal(rollbackTwo.ok, true);

      assert.equal(rollbackTwo.instruction.id, initial.id);

      assert.equal(rollbackTwo.instruction.version, '1.0');

      assert.equal(rollbackTwo.instruction.title, initial.title);

      assert.equal(rollbackTwo.instruction.intro, initial.intro);

      const historyAfterTwo = await flow.request(`/api/instructions/${initial.id}/history`, {
        admin: true,
      });

      assert.deepEqual(await historyAfterTwo.json(), {
        available: false,

        count: 0,
      });

      /*
       * ========================================
       * NO MORE HISTORY
       * ========================================
       */
      const emptyRollbackResponse = await flow.request(`/api/instructions/${initial.id}/rollback`, {
        method: 'POST',

        admin: true,
      });

      assert.equal(emptyRollbackResponse.status, 409);

      const emptyRollback = await emptyRollbackResponse.json();

      assert.match(emptyRollback.error, /нет предыдущей версии/iu);

      /*
       * ========================================
       * FINAL PERSISTENCE
       * ========================================
       */
      const finalStored = flow.instructionsRepository.getById(initial.id);

      assert.equal(finalStored.version, '1.0');

      assert.equal(finalStored.title, initial.title);

      assert.equal(flow.instructionsRepository.getById('malicious-new-id'), null);

      assert.equal(flow.instructionsRepository.getById('another-malicious-id'), null);

      const persistedPath = path.join(flow.instructionsDirectory, `${initial.id}.json`);

      const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));

      assert.equal(persisted.version, '1.0');

      assert.equal(persisted.title, initial.title);

      const instructionFiles = fs.readdirSync(flow.instructionsDirectory);

      assert.deepEqual(instructionFiles, [`${initial.id}.json`]);

      const safeHistoryId = Buffer.from(initial.id, 'utf8').toString('base64url');

      const historyPath = path.join(flow.historyDirectory, safeHistoryId);

      const remainingSnapshots = fs.existsSync(historyPath)
        ? fs.readdirSync(historyPath).filter(filename => filename.endsWith('.json'))
        : [];

      assert.equal(remainingSnapshots.length, 0, 'consumed rollback snapshots must be removed');
    } finally {
      await flow.cleanup();
    }
  },
);
