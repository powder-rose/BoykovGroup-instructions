import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { instructionsRepository } from '../src/services/instructionsRepository.js';
import { normalizeProfessionKey } from '../src/services/professionNormalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const orderServicePath = path.join(
  serverRoot,
  'src',
  'services',
  'publicGenerationOrderService.js',
);

const paidGenerationServicePath = path.join(
  serverRoot,
  'src',
  'services',
  'publicPaidGenerationService.js',
);

function createGeneratedSections() {
  const headings = [
    'Общие требования охраны труда',
    'Требования охраны труда перед началом работы',
    'Требования охраны труда во время работы',
    'Требования охраны труда в аварийных ситуациях',
    'Требования охраны труда по окончании работы',
  ];

  const detailedSafetyText = [
    'Работник обязан соблюдать установленные требования безопасности, использовать исправное оборудование, средства индивидуальной защиты и немедленно сообщать ответственному лицу обо всех обнаруженных неисправностях и опасных условиях.',
    'Перед выполнением каждой операции необходимо оценивать состояние рабочего места, исключать воздействие опасных факторов, соблюдать технологическую последовательность и не приступать к действиям, безопасность которых не обеспечена.',
    'При возникновении отклонений от нормального режима работы сотрудник обязан прекратить опасную операцию, принять доступные меры по предотвращению травмирования людей и действовать в соответствии с утвержденным порядком реагирования.',
  ];

  return headings.map((heading, sectionIndex) => ({
    number: sectionIndex + 1,

    heading,

    paragraphs: Array.from(
      {
        length: 3,
      },

      (_, paragraphIndex) => {
        const prefix = `${sectionIndex + 1}.` + `${paragraphIndex + 1}.`;

        return [
          prefix,
          detailedSafetyText[paragraphIndex % detailedSafetyText.length],
          `Контрольный раздел ${sectionIndex + 1},`,
          `пункт ${paragraphIndex + 1}.`,
          'Требование применяется в течение всей рабочей смены и является обязательным для соблюдения.',
        ].join(' ');
      },
    ),
  }));
}

function buildYandexStubSource() {
  return `
let generationCalls = 0;

const sections =
  ${JSON.stringify(createGeneratedSections())};

export function isYandexGptConfigured() {
  return true;
}

export async function generateInstructionWithYandexGpt() {
  generationCalls += 1;

  return {
    sections,
  };
}

export function getGenerationCalls() {
  return generationCalls;
}
`;
}

async function createIsolatedBusinessFlow() {
  const root = fs.mkdtempSync(path.join(serverRoot, 'boykovdocs-public-generation-flow-'));

  const ordersDirectory = path.join(root, 'orders');

  const locksDirectory = path.join(root, 'locks');

  const instructionsDirectory = path.join(root, 'instructions');

  fs.mkdirSync(instructionsDirectory, {
    recursive: true,
  });

  /*
   * ------------------------------------------
   * Isolated order storage
   * ------------------------------------------
   */
  const orderSource = fs.readFileSync(orderServicePath, 'utf8');

  const orderDirectoryDeclaration =
    "const ORDERS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationOrders');";

  assert.equal(
    orderSource.includes(orderDirectoryDeclaration),
    true,
    'publicGenerationOrderService storage declaration changed',
  );

  const isolatedOrderSource = orderSource
    .replace(orderDirectoryDeclaration, `const ORDERS_DIR = ${JSON.stringify(ordersDirectory)};`)
    .replace(/from '(\.{1,2}\/[^']+)'/gu, (_match, specifier) => {
      const absolutePath = path.resolve(path.dirname(orderServicePath), specifier);
      return `from '${pathToFileURL(absolutePath).href}'`;
    });

  const isolatedOrderPath = path.join(root, 'publicGenerationOrderService.mjs');

  fs.writeFileSync(isolatedOrderPath, isolatedOrderSource, 'utf8');

  const orderModuleUrl = pathToFileURL(isolatedOrderPath).href + `?test=${crypto.randomUUID()}`;

  /*
   * ------------------------------------------
   * Stub AI
   * ------------------------------------------
   *
   * Никаких реальных платных запросов.
   */
  const yandexStubPath = path.join(root, 'yandexGptService.mjs');

  fs.writeFileSync(yandexStubPath, buildYandexStubSource(), 'utf8');

  const yandexStubUrl = pathToFileURL(yandexStubPath).href;

  /*
   * ------------------------------------------
   * Isolated paid-generation service
   * ------------------------------------------
   */
  let paidSource = fs.readFileSync(paidGenerationServicePath, 'utf8');

  const lockDirectoryDeclaration =
    "const LOCKS_DIR = path.join(__dirname, '..', 'data', 'publicGenerationLocks');";

  assert.equal(
    paidSource.includes(lockDirectoryDeclaration),
    true,
    'publicPaidGenerationService lock declaration changed',
  );

  paidSource = paidSource.replace(
    lockDirectoryDeclaration,
    `const LOCKS_DIR = ${JSON.stringify(locksDirectory)};`,
  );

  const paidServiceDirectory = path.dirname(paidGenerationServicePath);

  /*
   * Переносим локальные imports на абсолютные
   * URL исходного проекта.
   *
   * Два исключения:
   * - order service -> временное хранилище;
   * - YandexGPT -> локальный бесплатный stub.
   */
  paidSource = paidSource.replace(
    /from '(\.{1,2}\/[^']+)'/gu,

    (match, specifier) => {
      if (specifier === './publicGenerationOrderService.js') {
        return `from '${orderModuleUrl}'`;
      }

      if (specifier === './yandexGptService.js') {
        return `from '${yandexStubUrl}'`;
      }

      const absolutePath = path.resolve(paidServiceDirectory, specifier);

      return `from '${pathToFileURL(absolutePath).href}'`;
    },
  );

  const isolatedPaidPath = path.join(root, 'publicPaidGenerationService.mjs');

  fs.writeFileSync(isolatedPaidPath, paidSource, 'utf8');

  const paidModuleUrl = pathToFileURL(isolatedPaidPath).href + `?test=${crypto.randomUUID()}`;

  const originalRepositoryDirectory = instructionsRepository.dir;

  const originalRepositoryCache = instructionsRepository.cache;

  instructionsRepository.dir = instructionsDirectory;

  instructionsRepository.cache = new Map();

  const orderService = await import(orderModuleUrl);

  const paidService = await import(paidModuleUrl);

  const yandexStub = await import(yandexStubUrl);

  return {
    root,

    ordersDirectory,

    locksDirectory,

    orderService,

    paidService,

    yandexStub,

    async cleanup() {
      try {
        await paidService.stopPublicGenerationProcessing();
      } finally {
        instructionsRepository.dir = originalRepositoryDirectory;

        instructionsRepository.cache = originalRepositoryCache;

        fs.rmSync(root, {
          recursive: true,
          force: true,
        });
      }
    },
  };
}

function markOrderPaid(orderService, order, transactionId) {
  const paidAt = new Date().toISOString();

  const updated = orderService.updatePublicGenerationOrder(order.id, {
    status: 'paid',

    transactionId,

    paidAt,
  });

  assert.ok(updated);

  return updated;
}

test(
  'paid generation delivers a private instruction to its owner without publishing it',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedBusinessFlow();

    try {
      const owner = {
        userId: 'business-flow-user-a',

        email: 'buyer-a@example.invalid',
      };

      const order = flow.orderService.createPublicGenerationOrder('Электромонтёр', {}, owner);

      markOrderPaid(flow.orderService, order, '910000001');

      const recoverableBefore = flow.orderService.listRecoverablePublicGenerationOrders();

      assert.equal(
        recoverableBefore.some(item => item.id === order.id),
        true,
        'paid order must survive as a recoverable business job',
      );

      await flow.paidService.processPublicGenerationOrder(order.id);

      const completed = flow.orderService.getPublicGenerationOrder(order.id);

      assert.ok(completed);

      assert.equal(completed.status, 'generated');

      /*
       * Покупатель уже получает готовый результат,
       * но публичной публикации ещё нет.
       */
      assert.equal(completed.publicationStatus, 'pending');

      assert.equal(completed.instructionId, null);

      assert.ok(completed.generatedInstruction);

      assert.equal(completed.generatedInstruction.generatedBy, 'public-payment');

      assert.equal(completed.generatedInstruction.paymentOrderId, order.id);

      assert.equal(flow.yandexStub.getGenerationCalls(), 1);

      /*
       * До approve документ не должен
       * оказаться в публичном repository.
       */
      assert.equal(
        instructionsRepository.getAll().length,
        0,
        'private paid result must not be published automatically',
      );

      const ownerOrders = flow.orderService.listPublicGenerationOrdersByOwner(owner.userId);

      assert.equal(ownerOrders.length, 1);

      assert.equal(ownerOrders[0].id, order.id);

      assert.equal(ownerOrders[0].hasInstruction, true);

      const ownerView = flow.orderService.getPublicGenerationOrderByOwnerView(
        order.id,
        owner.userId,
      );

      assert.ok(ownerView);

      assert.equal(ownerView.instruction?.id, completed.generatedInstruction.id);

      /*
       * Чужой пользователь заказ увидеть не может.
       */
      assert.equal(
        flow.orderService.getPublicGenerationOrderByOwnerView(order.id, 'different-user'),
        null,
      );

      const generatedId = completed.generatedInstruction.id;

      /*
       * Повторная обработка callback/recovery
       * не должна генерировать второй документ.
       */
      await flow.paidService.processPublicGenerationOrder(order.id);

      const repeated = flow.orderService.getPublicGenerationOrder(order.id);

      assert.equal(repeated.generatedInstruction.id, generatedId);

      assert.equal(
        flow.yandexStub.getGenerationCalls(),
        1,
        'already generated order must not charge another AI generation',
      );
    } finally {
      await flow.cleanup();
    }
  },
);

test(
  'paid order reuses an instruction that appeared before fulfillment instead of generating twice',
  {
    concurrency: false,
  },

  async () => {
    const flow = await createIsolatedBusinessFlow();

    try {
      const profession = 'Специалист по охране труда';

      const existingInstruction = {
        id: 'existing-business-flow-instruction',

        title: 'Инструкция по охране труда для специалиста по охране труда',

        profession,

        professionKey: normalizeProfessionKey(profession),

        intro: 'Существующая опубликованная инструкция.',

        sections: createGeneratedSections(),

        source: 'uploaded',

        version: '1.0',

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),
      };

      instructionsRepository.save(existingInstruction);

      const owner = {
        userId: 'business-flow-user-b',

        email: 'buyer-b@example.invalid',
      };

      const order = flow.orderService.createPublicGenerationOrder(profession, {}, owner);

      markOrderPaid(flow.orderService, order, '910000002');

      await flow.paidService.processPublicGenerationOrder(order.id);

      const completed = flow.orderService.getPublicGenerationOrder(order.id);

      assert.ok(completed);

      assert.equal(completed.status, 'generated');

      assert.equal(completed.publicationStatus, 'published');

      assert.equal(completed.instructionId, existingInstruction.id);

      assert.equal(completed.generatedInstruction?.id, existingInstruction.id);

      assert.ok(completed.publishedAt);

      /*
       * Если документ уже появился,
       * платный AI вообще не вызывается.
       */
      assert.equal(flow.yandexStub.getGenerationCalls(), 0);

      assert.equal(
        instructionsRepository.getAll().length,
        1,
        'existing public instruction must not be duplicated',
      );

      const ownerView = flow.orderService.getPublicGenerationOrderByOwnerView(
        order.id,
        owner.userId,
      );

      assert.equal(ownerView?.instructionId, existingInstruction.id);

      assert.equal(ownerView?.instruction?.id, existingInstruction.id);
    } finally {
      await flow.cleanup();
    }
  },
);
