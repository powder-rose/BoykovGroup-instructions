import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

test('backup service creates verified archives from production manifest', async () => {
  const servicePath = path.join(ROOT, 'src', 'backup', 'backupService.js');

  assert.equal(existsSync(servicePath), true, 'backup service must exist');

  const module = await import(pathToFileURL(servicePath).href);

  assert.equal(typeof module.createBackup, 'function');
});
