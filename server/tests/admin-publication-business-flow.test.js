import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const sourceRoot = path.join(serverRoot, 'src');

const TEST_JWT_SECRET = 'boykovdocs-admin-publication-business-flow-jwt-secret-2026';

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

function emptyDirectory(directory) {
  fs.rmSync(directory, {
    recursive: true,
    force: true,
  });

  fs.mkdirSync(directory, {
    recursive: true,
  });
}

async function createIsolatedAdminFlow() {
  /*
   * Полная копия server/src внутри server/.
   *
   * Все relative imports остаются настоящими,
   * но runtime JSON/storage оказываются
   * полностью отделены от рабочего проекта.
   */
  const root = fs.mkdtempSync(path.join(serverRoot, 'boykovdocs-admin-publication-flow-'));

  const sandboxSrc = path.join(root, 'src');

  fs.cpSync(sourceRoot, sandboxSrc, {
    recursive: true,
  });

  /*
   * Никогда не используем скопированные
   * runtime-данные.
   */
  const dataRoot = path.join(sandboxSrc, 'data');

  emptyDirectory(path.join(dataRoot, 'instructions'));

  emptyDirectory(path.join(dataRoot, 'publicGenerationOrders'));

  emptyDirectory(path.join(dataRoot, 'publicGenerationLocks'));

  emptyDirectory(path.join(dataRoot, 'instruction-history'));

  /*
   * Promo service импортируется роутером,
   * хотя в этих сценариях не используется.
   */
  fs.writeFileSync(path.join(dataRoot, 'promoCodes.json'), '[]\n', 'utf8');

  const previousJwtSecret = process.env.JWT_SECRET;

  process.env.JWT_SECRET = TEST_JWT_SECRET;

  let server = null;

  try {
    const moduleUrl = relativePath => pathToFileURL(path.join(sandboxSrc, relativePath)).href;

    const { publicGenerationRouter } = await import(moduleUrl('routes/publicGeneration.js'));

    const { attachUser } = await import(moduleUrl('middleware/auth.js'));

    const { issueAdminToken } = await import(moduleUrl('services/authService.js'));

    const orderService = await import(moduleUrl('services/publicGenerationOrderService.js'));

    const { instructionsRepository } = await import(
      moduleUrl('services/instructionsRepository.js')
    );

    const { normalizeProfessionKey } = await import(moduleUrl('services/professionNormalizer.js'));

    const paidGenerationService = await import(
      moduleUrl('services/publicPaidGenerationService.js')
    );

    const app = express();

    app.use(express.json());

    app.use(attachUser);

    app.use('/api/public-generation', publicGenerationRouter);

    server = await listen(app);

    const address = server.address();

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const adminToken = issueAdminToken();

    return {
      root,
      baseUrl,
      adminToken,
      orderService,
      instructionsRepository,
      normalizeProfessionKey,
      paidGenerationService,

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

          await paidGenerationService.stopPublicGenerationProcessing();
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

function createSections(label = 'Исходный') {
  return [
    {
      number: 1,
      heading: 'Общие требования охраны труда',
      paragraphs: [`1.1. ${label} текст общего раздела.`],
    },
    {
      number: 2,
      heading: 'Требования перед началом работы',
      paragraphs: [`2.1. ${label} текст перед началом работы.`],
    },
    {
      number: 3,
      heading: 'Требования во время работы',
      paragraphs: [`3.1. ${label} текст во время работы.`],
    },
    {
      number: 4,
      heading: 'Требования в аварийных ситуациях',
      paragraphs: [`4.1. ${label} текст аварийного раздела.`],
    },
    {
      number: 5,
      heading: 'Требования по окончании работы',
      paragraphs: [`5.1. ${label} текст по окончании работы.`],
    },
  ];
}

function createGeneratedInstruction(flow, { id, profession, title }) {
  const now = new Date().toISOString();

  return {
    id,

    title: title ?? `Инструкция по охране труда для ${profession}`,

    profession,

    professionKey: flow.normalizeProfessionKey(profession),

    intro: 'Приватная инструкция, подготовленная после оплаты.',

    sections: createSections(),

    source: 'generated',

    generatedBy: 'public-payment',

    version: '1.0',

    createdAt: now,

    updatedAt: now,
  };
}

function createPendingOrder(flow, { profession, instructionId, ownerUserId }) {
  const order = flow.orderService.createPublicGenerationOrder(
    profession,
    {},
    {
      userId: ownerUserId ?? 'publication-test-user',

      email: 'publication-user@example.invalid',
    },
  );

  const now = new Date().toISOString();

  const instruction = createGeneratedInstruction(flow, {
    id: instructionId,
    profession,
  });

  const updated = flow.orderService.updatePublicGenerationOrder(order.id, {
    status: 'generated',

    paidAt: now,

    generatedAt: now,

    generatedInstruction: instruction,

    publicationStatus: 'pending',

    instructionId: null,

    publishedAt: null,

    reviewedAt: null,

    reviewedBy: null,

    rejectionReason: null,
  });

  assert.ok(updated);

  return updated;
}

test(
  'admin can edit and approve a private paid draft exactly once',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedAdminFlow();

    try {
      const profession = 'Электромонтёр по ремонту оборудования';

      const pending = createPendingOrder(flow, {
        profession,

        instructionId: 'paid-draft-edit-approve',
      });

      /*
       * Админские данные нельзя читать
       * без admin JWT.
       */
      const unauthorizedInbox = await flow.request('/api/public-generation/admin/inbox');

      assert.equal(unauthorizedInbox.status, 401);

      const inboxResponse = await flow.request('/api/public-generation/admin/inbox', {
        admin: true,
      });

      assert.equal(inboxResponse.status, 200);

      const inbox = await inboxResponse.json();

      assert.equal(inbox.items.length, 1);

      assert.equal(inbox.items[0].id, pending.id);

      /*
       * До approve публичного документа нет.
       */
      assert.equal(flow.instructionsRepository.getAll().length, 0);

      /*
       * Frontend пытается изменить также
       * защищённые id/profession.
       *
       * Production route обязан их сохранить.
       */
      const editedTitle = 'Инструкция по охране труда для электромонтёра после проверки';

      const editResponse = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/instruction`,
        {
          method: 'PUT',

          admin: true,

          body: {
            instruction: {
              id: 'malicious-replacement-id',

              profession: 'Чужая профессия',

              title: `  ${editedTitle}  `,

              sections: createSections('Отредактированный'),
            },
          },
        },
      );

      assert.equal(editResponse.status, 200);

      const editResult = await editResponse.json();

      assert.equal(editResult.instruction.id, 'paid-draft-edit-approve');

      assert.equal(editResult.instruction.profession, profession);

      assert.equal(editResult.instruction.title, editedTitle);

      assert.equal(editResult.publicationStatus, 'pending');

      assert.equal(
        flow.instructionsRepository.getAll().length,
        0,
        'editing draft must not publish it',
      );

      /*
       * Approve публикует отредактированную
       * версию и связывает её с заказом.
       */
      const approveResponse = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/approve`,
        {
          method: 'POST',

          admin: true,
        },
      );

      assert.equal(approveResponse.status, 200);

      const approved = await approveResponse.json();

      assert.equal(approved.ok, true);

      assert.equal(approved.publicationStatus, 'published');

      assert.equal(approved.instructionId, 'paid-draft-edit-approve');

      const storedOrder = flow.orderService.getPublicGenerationOrder(pending.id);

      assert.equal(storedOrder.publicationStatus, 'published');

      assert.equal(storedOrder.instructionId, approved.instructionId);

      assert.ok(storedOrder.publishedAt);

      assert.ok(storedOrder.reviewedAt);

      assert.equal(storedOrder.reviewedBy, 'admin');

      assert.equal(storedOrder.rejectionReason, null);

      const publicInstruction = flow.instructionsRepository.getById(approved.instructionId);

      assert.ok(publicInstruction);

      assert.equal(publicInstruction.title, editedTitle);

      assert.equal(publicInstruction.profession, profession);

      assert.equal(flow.instructionsRepository.getAll().length, 1);

      /*
       * После публикации заказ исчезает
       * из admin inbox.
       */
      const inboxAfterResponse = await flow.request('/api/public-generation/admin/inbox', {
        admin: true,
      });

      const inboxAfter = await inboxAfterResponse.json();

      assert.equal(inboxAfter.items.length, 0);

      /*
       * Повторный approve идемпотентен:
       * никакого второго файла.
       */
      const secondApproveResponse = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/approve`,
        {
          method: 'POST',

          admin: true,
        },
      );

      assert.equal(secondApproveResponse.status, 200);

      const secondApprove = await secondApproveResponse.json();

      assert.equal(secondApprove.instructionId, approved.instructionId);

      assert.equal(flow.instructionsRepository.getAll().length, 1);

      /*
       * Published draft больше
       * редактировать нельзя.
       */
      const editAfterPublish = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/instruction`,
        {
          method: 'PUT',

          admin: true,

          body: {
            instruction: {
              title: 'Нельзя сохранить',

              sections: createSections(),
            },
          },
        },
      );

      assert.equal(editAfterPublish.status, 409);
    } finally {
      await flow.cleanup();
    }
  },
);

test(
  'admin rejection closes the draft without publishing it',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedAdminFlow();

    try {
      const pending = createPendingOrder(flow, {
        profession: 'Оператор производственной линии',

        instructionId: 'paid-draft-reject',
      });

      const rejectResponse = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/reject`,
        {
          method: 'POST',

          admin: true,

          body: {
            reason: 'Требуется существенная переработка документа.',
          },
        },
      );

      assert.equal(rejectResponse.status, 200);

      const rejected = await rejectResponse.json();

      assert.equal(rejected.publicationStatus, 'rejected');

      const storedOrder = flow.orderService.getPublicGenerationOrder(pending.id);

      assert.equal(storedOrder.publicationStatus, 'rejected');

      assert.equal(storedOrder.reviewedBy, 'admin');

      assert.equal(storedOrder.rejectionReason, 'Требуется существенная переработка документа.');

      assert.ok(storedOrder.reviewedAt);

      assert.equal(storedOrder.instructionId, null);

      assert.equal(
        flow.instructionsRepository.getAll().length,
        0,
        'rejected draft must not be published',
      );

      /*
       * Повторный reject идемпотентен.
       */
      const repeatReject = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/reject`,
        {
          method: 'POST',

          admin: true,

          body: {
            reason: 'Другая причина не должна переписать исходное решение.',
          },
        },
      );

      assert.equal(repeatReject.status, 200);

      const afterRepeat = flow.orderService.getPublicGenerationOrder(pending.id);

      assert.equal(afterRepeat.rejectionReason, 'Требуется существенная переработка документа.');

      /*
       * После reject ни edit, ни approve
       * больше не допускаются.
       */
      const editAfterReject = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/instruction`,
        {
          method: 'PUT',

          admin: true,

          body: {
            instruction: {
              title: 'Попытка редактирования',

              sections: createSections(),
            },
          },
        },
      );

      assert.equal(editAfterReject.status, 409);

      const approveAfterReject = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/approve`,
        {
          method: 'POST',

          admin: true,
        },
      );

      assert.equal(approveAfterReject.status, 409);

      assert.equal(flow.instructionsRepository.getAll().length, 0);
    } finally {
      await flow.cleanup();
    }
  },
);

test(
  'admin approval reuses an existing public instruction instead of creating a duplicate',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedAdminFlow();

    try {
      const profession = 'Специалист по эксплуатации зданий';

      const existing = createGeneratedInstruction(flow, {
        id: 'already-published-instruction',

        profession,

        title: 'Инструкция по охране труда для специалиста по эксплуатации зданий',
      });

      flow.instructionsRepository.save(existing);

      const pending = createPendingOrder(flow, {
        profession,

        instructionId: 'private-duplicate-draft',
      });

      const approveResponse = await flow.request(
        `/api/public-generation/admin/orders/${pending.id}/approve`,
        {
          method: 'POST',

          admin: true,
        },
      );

      assert.equal(approveResponse.status, 200);

      const approved = await approveResponse.json();

      assert.equal(approved.publicationStatus, 'published');

      /*
       * Заказ должен ссылаться именно
       * на ранее существующий документ.
       */
      assert.equal(approved.instructionId, existing.id);

      const storedOrder = flow.orderService.getPublicGenerationOrder(pending.id);

      assert.equal(storedOrder.instructionId, existing.id);

      assert.equal(storedOrder.publicationStatus, 'published');

      assert.ok(storedOrder.publishedAt);

      assert.equal(
        flow.instructionsRepository.getAll().length,
        1,
        'approval must not create a duplicate instruction',
      );

      assert.equal(flow.instructionsRepository.getById('private-duplicate-draft'), null);
    } finally {
      await flow.cleanup();
    }
  },
);
