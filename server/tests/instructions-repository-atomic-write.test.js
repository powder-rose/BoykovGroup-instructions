import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { instructionsRepository } from '../src/services/instructionsRepository.js';

test(
  'failed instruction save never corrupts the previously committed JSON',
  { concurrency: false },
  () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boykovdocs-instruction-atomic-'),
    );

    const originalDirectory = instructionsRepository.dir;

    const originalCache = instructionsRepository.cache;

    instructionsRepository.dir = temporaryDirectory;

    instructionsRepository.cache = new Map();

    const instructionId = 'atomic-write-probe';

    const filePath = path.join(temporaryDirectory, `${instructionId}.json`);

    const originalInstruction = {
      id: instructionId,
      title: 'Previously committed instruction',
      version: '1.0',
    };

    try {
      instructionsRepository.save(originalInstruction);

      const originalWriteFileSync = fs.writeFileSync;

      fs.writeFileSync = function (targetPath, data, options) {
        if (String(targetPath).includes(instructionId)) {
          /*
           * Имитируем реальный аварийный сценарий:
           *
           * файловая система успела записать
           * только часть JSON, после чего
           * запись завершилась ошибкой.
           */
          originalWriteFileSync.call(fs, targetPath, '{"id":"atomic-write-probe"', options);

          const error = new Error('simulated interrupted write');

          error.code = 'ENOSPC';

          throw error;
        }

        return originalWriteFileSync.call(fs, targetPath, data, options);
      };

      try {
        assert.throws(
          () =>
            instructionsRepository.save({
              ...originalInstruction,
              title: 'New instruction',
              version: '1.1',
            }),
          /simulated interrupted write/u,
        );
      } finally {
        fs.writeFileSync = originalWriteFileSync;
      }

      /*
       * Главное требование:
       *
       * неудачная новая запись не должна
       * разрушать последний успешно
       * сохранённый документ.
       */
      const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      assert.equal(persisted.title, 'Previously committed instruction');

      assert.equal(persisted.version, '1.0');

      /*
       * Cache также должен продолжать
       * указывать на последний успешно
       * сохранённый объект.
       */
      assert.equal(
        instructionsRepository.getById(instructionId).title,
        'Previously committed instruction',
      );

      /*
       * После ошибки не должны оставаться
       * незавершённые временные файлы.
       */
      const files = fs.readdirSync(temporaryDirectory);

      assert.deepEqual(files, [`${instructionId}.json`]);
    } finally {
      instructionsRepository.dir = originalDirectory;

      instructionsRepository.cache = originalCache;

      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  },
);
