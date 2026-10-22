import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(
  new URL('../scripts/checkInstructionReclassification.js', import.meta.url),
);
const headers = [
  'document_id',
  'url',
  'title_from_url_verify',
  'catalog',
  'section_id',
  'section_name',
  'tags_ids',
  'tags_names',
  'review_status',
  'lastmod',
  'notes',
];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-reclassification-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'instructions');
  fs.mkdirSync(directory);
  const record = {
    id: 'internal-id',
    slug: 'Public-MiXeD',
    title: 'Настоящее название инструкции',
    primaryCategoryId: 'legacy-category',
    tagIds: ['legacy-tag'],
    seoTitle: 'Сохранённое SEO-название',
    sections: [{ heading: 'Текст документа', paragraphs: ['Сохранённое содержание'] }],
    revision: 5,
  };
  fs.writeFileSync(path.join(directory, 'instruction.json'), JSON.stringify(record));
  const source = path.join(root, 'import.csv');
  fs.writeFileSync(
    source,
    '\uFEFF' +
      [
        headers.join(';'),
        [
          '1',
          'https://boykovdocs.ru/instrukciya-po-ohrane-truda/Public-MiXeD',
          'Не использовать как H1',
          'По профессиям и должностям',
          'P01',
          'Руководители',
          'T01',
          'Тема',
          'Предварительно классифицировано по смыслу заголовка',
          '2026-10-21',
          '',
        ].join(';'),
      ].join('\r\n'),
  );
  const manual = path.join(root, 'manual.csv');
  fs.writeFileSync(manual, 'ID;URL;Стало ID;Стало название\n');
  const changed = path.join(root, 'changed.csv');
  fs.writeFileSync(changed, 'ID;URL;Стало ID;Стало название;Было ID;Было название;Каталог\n');
  const dictionary = path.join(root, 'dictionary.json');
  fs.writeFileSync(
    dictionary,
    JSON.stringify({
      catalogs: [
        {
          code: 'H01',
          name: 'По профессиям и должностям',
          url: 'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-professiyam/',
        },
      ],
      sections: [
        {
          code: 'P01',
          name: 'Руководители',
          catalogCode: 'H01',
          url: 'https://boykovdocs.ru/instrukcii-po-ohrane-truda/po-professiyam/rukovoditeli/',
        },
      ],
      tags: [
        {
          code: 'T01',
          name: 'Тема',
          url: 'https://boykovdocs.ru/instrukcii-po-ohrane-truda/temy/tema/',
        },
      ],
      issues: [{ code: 'pending-editorial-review', description: 'Pending review' }],
    }),
  );
  const args = [
    '--import',
    source,
    '--manual',
    manual,
    '--changed',
    changed,
    '--dictionary',
    dictionary,
  ];
  return { root, directory, source, manual, args };
}

function run(args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('CLI source checks never claim a live-data match and do not create a repository', t => {
  const f = fixture(t);
  const before = fs.readdirSync(f.root).sort();
  const result = run(f.args);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'source-only');
  assert.equal(report.liveDataChecked, false);
  assert.equal(report.applySupported, false);
  assert.equal(report.counts.matched, 0);
  assert.equal(report.snapshot, null);
  assert.deepEqual(fs.readdirSync(f.root).sort(), before);
});

test('snapshot matching preserves every input byte and timestamp; report is a new file', t => {
  const f = fixture(t);
  const file = path.join(f.directory, 'instruction.json');
  const before = fs.readFileSync(file);
  const mtime = fs.statSync(file).mtimeMs;
  const output = path.join(f.root, 'report.json');
  const result = run([...f.args, '--directory', f.directory, '--output', output]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(report.liveDataChecked, true);
  assert.equal(report.counts.matched, 1);
  assert.equal(report.records[0].existing.id, 'internal-id');
  assert.equal(report.snapshot.files[0].sha256.length, 64);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
  assert.deepEqual(fs.readdirSync(f.directory), ['instruction.json']);
  const repeated = run([...f.args, '--output', output]);
  assert.equal(repeated.status, 1);
  assert.match(repeated.stderr, /EEXIST/u);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), report);
});

test('CLI rejects apply flags and output paths inside the snapshot before writing', t => {
  const f = fixture(t);
  assert.equal(run([...f.args, '--apply']).status, 1);
  const output = path.join(f.directory, 'new-report.json');
  const result = run([...f.args, '--directory', f.directory, '--output', output]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside the instruction snapshot/u);
  assert.equal(fs.existsSync(output), false);
});

test('missing, empty, corrupt and symlink snapshots fail instead of silently checking zero files', t => {
  const f = fixture(t);
  const missing = run([...f.args, '--directory', path.join(f.root, 'missing')]);
  assert.equal(missing.status, 1);
  assert.equal(fs.existsSync(path.join(f.root, 'missing')), false);
  fs.unlinkSync(path.join(f.directory, 'instruction.json'));
  assert.equal(run([...f.args, '--directory', f.directory]).status, 1);
  fs.writeFileSync(path.join(f.directory, 'broken.json'), '{broken');
  assert.equal(run([...f.args, '--directory', f.directory]).status, 1);
  fs.unlinkSync(path.join(f.directory, 'broken.json'));
  if (process.platform !== 'win32') {
    fs.symlinkSync(f.source, path.join(f.directory, 'linked.json'));
    const linked = run([...f.args, '--directory', f.directory]);
    assert.equal(linked.status, 1);
    assert.match(linked.stderr, /regular file/u);
  }
});

test('CLI reports malformed source data with a failing exit code and retains the report', t => {
  const f = fixture(t);
  fs.appendFileSync(f.manual, 'DOC-99;https://boykovdocs.ru/missing;P01;Руководители\n');
  const result = run(f.args);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.length);
  assert.equal(report.applySupported, false);
});

test('legacy null URL and tag fields retain the existing ID URL fallback', t => {
  const f = fixture(t);
  const file = path.join(f.directory, 'instruction.json');
  const instruction = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(
    file,
    JSON.stringify({ ...instruction, slug: null, slugAliases: null, tagIds: null }),
  );
  fs.writeFileSync(
    f.source,
    fs.readFileSync(f.source, 'utf8').replace('Public-MiXeD', 'internal-id'),
  );
  const result = run([...f.args, '--directory', f.directory]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.counts.matched, 1);
  assert.equal(report.records[0].existing.tagIds, null);
});
