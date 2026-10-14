import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import cron from 'node-cron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('node-cron security baseline is pinned to 4.6.0', () => {
  const packageJson = readJson(path.join(serverRoot, 'node_modules', 'node-cron', 'package.json'));

  assert.equal(packageJson.version, '4.6.0', 'BoykovDocs must use node-cron 4.6.0');
});

test('BoykovDocs production cron expressions remain valid', () => {
  const expressions = ['0 * * * *', '0 3,11,19 * * *'];

  for (const expression of expressions) {
    assert.equal(cron.validate(expression), true, `Expected valid cron expression: ${expression}`);
  }

  assert.equal(cron.validate('not-a-cron-expression'), false);
});

test('scheduled tasks still expose start and stop controls', () => {
  let executed = false;

  /*
   * Intentionally schedule a distant date so this
   * compatibility test never runs the callback.
   */
  const task = cron.schedule('0 0 1 1 *', () => {
    executed = true;
  });

  try {
    assert.equal(typeof task.start, 'function');

    assert.equal(typeof task.stop, 'function');

    task.stop();

    assert.equal(executed, false);
  } finally {
    /*
     * Both v3 and v4 support stop().
     * v4 additionally exposes destroy().
     */
    task.stop();

    if (typeof task.destroy === 'function') {
      task.destroy();
    }
  }
});

test('timezone scheduling contract remains supported', () => {
  const task = cron.schedule('0 0 1 1 *', () => {}, {
    timezone: 'Europe/Moscow',
  });

  try {
    assert.equal(typeof task.stop, 'function');

    task.stop();
  } finally {
    task.stop();

    if (typeof task.destroy === 'function') {
      task.destroy();
    }
  }
});
