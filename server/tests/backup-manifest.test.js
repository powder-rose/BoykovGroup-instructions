import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_ROOT = path.resolve(__dirname, '..');

test('backup manifest defines production data protection contract', async () => {
  const manifestPath = path.join(SERVER_ROOT, 'src', 'backup', 'backupManifest.js');

  assert.equal(existsSync(manifestPath), true, 'backup manifest must exist');

  const module = await import(pathToFileURL(manifestPath).href);

  assert.ok(module.backupManifest, 'backupManifest export missing');

  const { version, includedPaths, excludedPaths, retentionDays } = module.backupManifest;

  assert.equal(typeof version, 'string');

  assert.ok(Array.isArray(includedPaths));

  assert.ok(includedPaths.includes('server/src/data'));

  assert.ok(includedPaths.includes('server/data'));

  assert.ok(Array.isArray(excludedPaths));

  assert.ok(retentionDays >= 7, 'retention must keep at least 7 backups');
});
