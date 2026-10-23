import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { checkInstructionTaxonomyAcceptance } from '../scripts/checkInstructionTaxonomyAcceptance.js';
import { getInstructionTaxonomyRegistrySeed } from '../src/services/instructionTaxonomySource.js';

const SCRIPT = fileURLToPath(
  new URL('../scripts/checkInstructionTaxonomyAcceptance.js', import.meta.url),
);

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-taxonomy-acceptance-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const instructions = path.join(directory, 'instructions');
  fs.mkdirSync(instructions);
  const record = {
    id: 'accountant',
    title: 'Инструкция по охране труда для бухгалтера',
    slug: 'Buhgalter-MixedCase',
    revision: 1,
    status: 'published',
    primaryCategoryId: 'P02',
    tagIds: [],
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Исходный текст' }] }],
    },
  };
  const recordFile = path.join(instructions, `${record.id}.json`);
  fs.writeFileSync(recordFile, JSON.stringify(record));
  const registry = getInstructionTaxonomyRegistrySeed();
  registry.revision = 7;
  const registryDirectory = path.join(directory, 'registry-data');
  fs.mkdirSync(registryDirectory);
  const registryFile = path.join(registryDirectory, 'registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(registry));
  const output = path.join(directory, 'report');
  const args = ['--directory', instructions, '--registry', registryFile, '--output-dir', output];
  return { directory, instructions, record, recordFile, registry, registryFile, output, args };
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('acceptance CLI writes new reports while preserving snapshot and explicit registry bytes', async t => {
  const context = fixture(t);
  const before = [context.recordFile, context.registryFile].map(sha256);
  const result = await checkInstructionTaxonomyAcceptance(context.args);
  assert.deepEqual([context.recordFile, context.registryFile].map(sha256), before);
  assert.deepEqual(fs.readdirSync(context.instructions), ['accountant.json']);
  assert.deepEqual(fs.readdirSync(context.output).sort(), [
    'acceptance.json',
    'report.md',
    'urls.csv',
  ]);
  const saved = JSON.parse(fs.readFileSync(path.join(context.output, 'acceptance.json'), 'utf8'));
  assert.equal(saved.inputs.registry.source, 'explicit-snapshot');
  assert.equal(saved.inputs.registry.sha256, before[1]);
  assert.equal(saved.inputs.instructions.files[0].sha256, before[0]);
  assert.equal(saved.inputs.baseline, null);
  assert.equal(result.httpReport, null);
  assert.ok(saved.urls.some(item => item.path.endsWith('/Buhgalter-MixedCase')));
  const summary = fs.readFileSync(path.join(context.output, 'report.md'), 'utf8');
  assert.match(summary, /HTTP-проверка не выполнялась/u);
  assert.match(summary, /не доказывает сохранность прежних URL/u);
});

test('acceptance CLI uses the committed seed only when registry input is omitted', async t => {
  const context = fixture(t);
  const result = await checkInstructionTaxonomyAcceptance([
    '--directory',
    context.instructions,
    '--output-dir',
    context.output,
  ]);
  assert.equal(result.report.inputs.registry.source, 'committed-seed');
  assert.match(result.report.inputs.registry.file, /instructionTaxonomyCatalog\.json$/u);
  assert.equal(result.report.inputs.registry.file.includes(context.directory), false);
});

test('acceptance CLI fails on a missing explicit registry instead of silently using seed', async t => {
  const context = fixture(t);
  fs.rmSync(context.registryFile);
  await assert.rejects(checkInstructionTaxonomyAcceptance(context.args), /ENOENT/u);
  assert.equal(fs.existsSync(context.output), false);
});

test('acceptance CLI never overwrites an existing report directory', async t => {
  const context = fixture(t);
  fs.mkdirSync(context.output);
  const marker = path.join(context.output, 'acceptance.json');
  fs.writeFileSync(marker, 'existing report');
  await assert.rejects(checkInstructionTaxonomyAcceptance(context.args), /must be new/u);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'existing report');
});

test('acceptance CLI rejects output within the instruction snapshot', async t => {
  const context = fixture(t);
  context.args[context.args.length - 1] = path.join(context.instructions, 'report');
  const hash = sha256(context.recordFile);
  await assert.rejects(checkInstructionTaxonomyAcceptance(context.args), /outside every/u);
  assert.equal(sha256(context.recordFile), hash);
  assert.deepEqual(fs.readdirSync(context.instructions), ['accountant.json']);
});

test('acceptance CLI rejects output inside the registry input directory', async t => {
  const context = fixture(t);
  context.args[context.args.length - 1] = path.join(path.dirname(context.registryFile), 'report');
  const before = sha256(context.registryFile);
  await assert.rejects(checkInstructionTaxonomyAcceptance(context.args), /registry directory/u);
  assert.equal(sha256(context.registryFile), before);
  assert.equal(fs.existsSync(context.args[context.args.length - 1]), false);
});

test('acceptance CLI includes baseline fingerprints and keeps both input snapshots unchanged', async t => {
  const context = fixture(t);
  const baseline = path.join(context.directory, 'baseline');
  fs.mkdirSync(baseline);
  const baselineFile = path.join(baseline, 'accountant.json');
  fs.copyFileSync(context.recordFile, baselineFile);
  const before = [context.recordFile, baselineFile].map(sha256);
  const result = await checkInstructionTaxonomyAcceptance([
    ...context.args,
    '--baseline-directory',
    baseline,
  ]);
  assert.deepEqual([context.recordFile, baselineFile].map(sha256), before);
  assert.equal(result.report.inputs.baseline.files[0].sha256, before[1]);
  assert.equal(result.report.baseline.checked, true);
});

test('acceptance CLI also rejects report output inside the baseline snapshot', async t => {
  const context = fixture(t);
  const baseline = path.join(context.directory, 'baseline');
  fs.mkdirSync(baseline);
  fs.copyFileSync(context.recordFile, path.join(baseline, 'accountant.json'));
  context.args[context.args.length - 1] = path.join(baseline, 'report');
  await assert.rejects(
    checkInstructionTaxonomyAcceptance([...context.args, '--baseline-directory', baseline]),
    /outside every/u,
  );
});

test('acceptance CSV uses UTF-8 BOM, semicolons, escaped quotes and spreadsheet formula protection', async t => {
  const context = fixture(t);
  context.registry.root.name = '=HYPERLINK("https://example.invalid")';
  fs.writeFileSync(context.registryFile, JSON.stringify(context.registry));
  await checkInstructionTaxonomyAcceptance(context.args);
  const bytes = fs.readFileSync(path.join(context.output, 'urls.csv'));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = bytes.toString('utf8');
  assert.match(csv, /"recordType";"kind"/u);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/u);
  assert.ok(csv.includes('Buhgalter-MixedCase'));
  assert.ok(csv.includes('"technical"'));
  assert.ok(csv.includes('?sort=newest'));
});

test('acceptance CLI rejects invalid UTF-8 registry input before writing', async t => {
  const context = fixture(t);
  fs.writeFileSync(context.registryFile, Buffer.from([0xff, 0xfe, 0x7b]));
  await assert.rejects(checkInstructionTaxonomyAcceptance(context.args), /encoded data/u);
  assert.equal(fs.existsSync(context.output), false);
});

test('acceptance CLI requires directory and output flags and rejects malformed origins', async t => {
  const context = fixture(t);
  await assert.rejects(checkInstructionTaxonomyAcceptance([]), /--directory is required/u);
  await assert.rejects(
    checkInstructionTaxonomyAcceptance(['--directory', context.instructions]),
    /--output-dir is required/u,
  );
  await assert.rejects(
    checkInstructionTaxonomyAcceptance([...context.args, '--origin', 'https://example.test/path']),
    /HTTP или HTTPS/u,
  );
  assert.equal(fs.existsSync(context.output), false);
});

test('acceptance CLI help works without snapshots and direct invocation uses fatal exit code 2', async () => {
  assert.equal(await checkInstructionTaxonomyAcceptance(['--help']), null);
  const help = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--baseline-directory/u);
  const missing = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--directory is required/u);
});

test(
  'acceptance CLI rejects symbolic input files and canonicalizes output parent links',
  {
    skip:
      process.platform === 'win32'
        ? 'Creating symbolic links needs extra Windows privileges'
        : false,
  },
  async t => {
    const context = fixture(t);
    const linkedRegistry = path.join(context.directory, 'registry-link.json');
    fs.symlinkSync(context.registryFile, linkedRegistry);
    const args = [...context.args];
    args[3] = linkedRegistry;
    await assert.rejects(checkInstructionTaxonomyAcceptance(args), /regular file/u);
    const linkedParent = path.join(context.directory, 'snapshot-link');
    fs.symlinkSync(context.instructions, linkedParent, 'dir');
    const linkedOutputArgs = [...context.args];
    linkedOutputArgs[5] = path.join(linkedParent, 'report');
    await assert.rejects(checkInstructionTaxonomyAcceptance(linkedOutputArgs), /outside every/u);
    assert.equal(fs.existsSync(path.join(context.instructions, 'report')), false);
  },
);

test('acceptance CLI refuses stale reports when snapshot bytes change during HTTP inspection', async t => {
  const context = fixture(t);
  let changed = false;
  const server = createServer((request, response) => {
    if (!changed) {
      changed = true;
      fs.writeFileSync(
        context.recordFile,
        JSON.stringify({ ...context.record, title: 'Изменено извне' }),
      );
    }
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<title>Missing</title><h1>Missing</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(
    checkInstructionTaxonomyAcceptance([...context.args, '--http-origin', origin]),
    /snapshot changed during audit/u,
  );
  assert.equal(changed, true);
  assert.equal(fs.existsSync(context.output), false);
  assert.equal(JSON.parse(fs.readFileSync(context.recordFile, 'utf8')).title, 'Изменено извне');
});

test('acceptance CLI rejects instruction filenames that do not match IDs in either snapshot', async t => {
  const context = fixture(t);
  const renamed = path.join(context.instructions, 'different-id.json');
  fs.renameSync(context.recordFile, renamed);
  const before = sha256(renamed);
  await assert.rejects(
    checkInstructionTaxonomyAcceptance(context.args),
    /filename must match its ID/u,
  );
  assert.equal(sha256(renamed), before);
  assert.equal(fs.existsSync(context.output), false);
  fs.renameSync(renamed, context.recordFile);
  const baseline = path.join(context.directory, 'baseline');
  fs.mkdirSync(baseline);
  const baselineFile = path.join(baseline, 'mismatched-name.json');
  fs.copyFileSync(context.recordFile, baselineFile);
  await assert.rejects(
    checkInstructionTaxonomyAcceptance([...context.args, '--baseline-directory', baseline]),
    /filename must match its ID/u,
  );
  assert.equal(sha256(baselineFile), before);
  assert.equal(fs.existsSync(context.output), false);
});
