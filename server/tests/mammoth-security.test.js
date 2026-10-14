import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('Mammoth dependency hardening uses argparse 2.0.1 without sprintf-js', () => {
  const argparsePackage = readJson(
    path.join(serverRoot, 'node_modules', 'argparse', 'package.json'),
  );

  assert.equal(
    argparsePackage.version,
    '2.0.1',
    'Mammoth must use the hardened argparse 2.0.1 compatibility branch',
  );

  const sprintfPath = path.join(serverRoot, 'node_modules', 'sprintf-js');

  assert.equal(
    fs.existsSync(sprintfPath),
    false,
    'vulnerable sprintf-js must not remain in the production dependency tree',
  );
});

test('Mammoth library API still exposes extractRawText', async () => {
  const mammoth = await import('mammoth');

  const api = mammoth.default ?? mammoth;

  assert.equal(typeof api.extractRawText, 'function');
});

test('Mammoth CLI remains compatible with the argparse override', () => {
  const cliPath = path.join(serverRoot, 'node_modules', 'mammoth', 'bin', 'mammoth');

  const result = spawnSync(process.execPath, [cliPath, '--help'], {
    cwd: serverRoot,

    encoding: 'utf8',

    timeout: 10_000,
  });

  assert.equal(result.error, undefined, result.error?.message);

  assert.equal(
    result.status,
    0,
    ['Mammoth CLI must remain compatible.', '', result.stdout, result.stderr].join('\n'),
  );

  assert.match(result.stdout + result.stderr, /usage:/iu);
});
