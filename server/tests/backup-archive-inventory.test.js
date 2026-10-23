import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { checkBackupArchiveInventory } from '../src/backup/backupArchiveInventory.js';
import { readBackupInventory } from '../src/backup/backupInventory.js';

const BLOCK_SIZE = 512;
const ZERO_BLOCKS = Buffer.alloc(BLOCK_SIZE * 2);

function octal(value, width) {
  return `${value.toString(8).padStart(width - 1, '0')}\0`;
}

function checksum(header) {
  header.fill(0x20, 148, 156);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function header({ name = 'item', rawName, prefix = '', size = 0, type = '0' } = {}) {
  const bytes = Buffer.alloc(BLOCK_SIZE);
  (rawName || Buffer.from(name, 'utf8')).copy(bytes, 0, 0, 100);
  bytes.write(octal(type === '5' ? 0o700 : 0o600, 8), 100, 8, 'ascii');
  bytes.write(octal(0, 8), 108, 8, 'ascii');
  bytes.write(octal(0, 8), 116, 8, 'ascii');
  bytes.write(octal(size, 12), 124, 12, 'ascii');
  bytes.write(octal(0, 12), 136, 12, 'ascii');
  bytes.write(type, 156, 1, 'ascii');
  bytes.write('ustar\0', 257, 6, 'ascii');
  bytes.write('00', 263, 2, 'ascii');
  Buffer.from(prefix, 'utf8').copy(bytes, 345, 0, 155);
  return checksum(bytes);
}

function entry(name, body = Buffer.alloc(0), options = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  const padding = Buffer.alloc((BLOCK_SIZE - (bytes.length % BLOCK_SIZE)) % BLOCK_SIZE);
  return Buffer.concat([header({ name, size: bytes.length, ...options }), bytes, padding]);
}

function paxRecord(key, value) {
  const contents = Buffer.from(`${key}=${value}\n`, 'utf8');
  let length = contents.length + 2;
  while (String(length).length + 1 + contents.length !== length) {
    length = String(length).length + 1 + contents.length;
  }
  return Buffer.concat([Buffer.from(`${length} `), contents]);
}

function pax(fields, type = 'x') {
  const body = Buffer.concat(fields.map(([key, value]) => paxRecord(key, value)));
  return entry('PaxHeader', body, { type });
}

function expected(entries) {
  return {
    entries: entries.map(([pathname, kind = 'file', size = 0]) => ({
      path: pathname,
      kind,
      size,
    })),
  };
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-tar-header-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const archivePath = path.join(directory, 'archive.tar.gz');
  return {
    directory,
    archivePath,
    write(parts, { ending = ZERO_BLOCKS } = {}) {
      fs.writeFileSync(archivePath, gzipSync(Buffer.concat([...parts, ending])));
      return archivePath;
    },
  };
}

test('archive header validation preserves Unicode names, zero-length files, directories and ustar prefixes', async t => {
  const context = fixture(t);
  const bytes = Buffer.from([0, 255, 128, 13, 10]);
  const inventory = expected([
    ['server/uploads/imports/Исходник инструкции.docx', 'file', bytes.length],
    ['server/uploads/empty', 'directory'],
    ['server/uploads/zero.txt'],
    ['server/uploads/prefixed.txt', 'file', 3],
    ['server/uploads/\ufeffliteral-bom.txt', 'file', 1],
  ]);
  context.write([
    entry(inventory.entries[0].path, bytes),
    entry('server/uploads/empty/', '', { type: '5' }),
    entry('server/uploads/zero.txt', '', { type: '\0' }),
    entry('prefixed.txt', 'abc', { prefix: 'server/uploads' }),
    entry('\ufeffliteral-bom.txt', 'x', { prefix: 'server/uploads' }),
  ]);
  await checkBackupArchiveInventory(context.archivePath, inventory);
});

test('PAX UTF-8 byte lengths and local path/size overrides do not depend on display encoding', async t => {
  const context = fixture(t);
  const pathname = `server/uploads/imports/${'Инструкция'.repeat(8)}.docx`;
  const brokenFallback = Buffer.concat([Buffer.alloc(99, 0x61), Buffer.from([0xd0])]);
  context.write([
    pax(
      [
        ['mtime', '1700000000.123456789'],
        ['uid', '42'],
      ],
      'g',
    ),
    pax([
      ['path', pathname],
      ['size', '5'],
      ['hdrcharset', 'UTF-8'],
    ]),
    entry('fallback', Buffer.from([0, 255, 1, 2, 3]), { rawName: brokenFallback, size: 0 }),
  ]);
  await checkBackupArchiveInventory(context.archivePath, expected([[pathname, 'file', 5]]));
});

test('GNU long-name records preserve long UTF-8 names without exposing their metadata pseudo-path', async t => {
  const context = fixture(t);
  const pathname = `server/uploads/imports/${'Длинное имя'.repeat(10)}.bin`;
  context.write([
    entry('././@LongLink', Buffer.from(`${pathname}\0`, 'utf8'), { type: 'L' }),
    entry('truncated-placeholder', 'data'),
  ]);
  await checkBackupArchiveInventory(context.archivePath, expected([[pathname, 'file', 4]]));
});

test('native tar archives with long Cyrillic upload names match the filesystem inventory', async t => {
  const context = fixture(t);
  const sourceRoot = path.join(context.directory, 'app');
  fs.mkdirSync(path.join(sourceRoot, 'server/src/data'), { recursive: true });
  const imports = path.join(sourceRoot, 'server/uploads/imports');
  fs.mkdirSync(imports, { recursive: true });
  fs.writeFileSync(path.join(imports, `${'Инструкция'.repeat(7)}.bin`), Buffer.from([0, 255, 128]));
  const inventory = await readBackupInventory({ sourceRoot });
  execFileSync('tar', ['-czf', context.archivePath, '--', ...inventory.includedPaths], {
    cwd: sourceRoot,
  });
  await checkBackupArchiveInventory(context.archivePath, inventory);
});

test('exact archive membership rejects missing, extra, duplicate, wrong-kind and wrong-size entries', async t => {
  const context = fixture(t);
  const inventory = expected([['server/data/one.json', 'file', 1]]);
  for (const parts of [
    [],
    [entry('server/data/one.json', 'a'), entry('server/data/extra.json')],
    [entry('server/data/one.json', 'a'), entry('server/data/one.json', 'a')],
    [entry('server/data/one.json/', '', { type: '5' })],
    [entry('server/data/one.json', 'ab')],
  ]) {
    context.write(parts);
    await assert.rejects(checkBackupArchiveInventory(context.archivePath, inventory));
  }
});

test('links, devices, sparse records and other special archive members cannot pass as ordinary files', async t => {
  const context = fixture(t);
  for (const type of ['1', '2', '3', '4', '6', 'S', 'K']) {
    context.write([entry('server/data/one.json', '', { type })]);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([['server/data/one.json']])),
      /link or unsupported archive member/u,
    );
  }
});

test('unsafe archive paths remain rejected even when the expected inventory contains the same text', async t => {
  const context = fixture(t);
  for (const pathname of [
    '/server/data/one.json',
    '../escape.json',
    'server/../escape.json',
    'server/./data/one.json',
    'server//data/one.json',
    'C:/outside.json',
    'server\\data\\one.json',
    'server/data/line\nbreak.json',
  ]) {
    context.write([entry(pathname)]);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([[pathname]])),
      /unsafe archive member/u,
    );
  }
});

test('PAX path overrides are checked before extraction and risky metadata cannot reinterpret ordinary members', async t => {
  const context = fixture(t);
  for (const fields of [
    [['path', '../escape.json']],
    [['hdrcharset', 'BINARY']],
    [['linkpath', 'server/data/target.json']],
    [['GNU.sparse.map', '0,1']],
    [['SCHILY.filetype', 'symlink']],
  ]) {
    context.write([pax(fields), entry('server/data/one.json')]);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([['server/data/one.json']])),
    );
  }
});

test('ambiguous global path/size and mixed pending filename extensions fail closed', async t => {
  const context = fixture(t);
  const pathname = 'server/data/one.json';
  const longName = () =>
    entry('././@LongLink', Buffer.from(`${pathname}\0`, 'utf8'), { type: 'L' });
  for (const metadata of [
    [pax([['path', pathname]], 'g')],
    [pax([['path', '']], 'g')],
    [pax([['size', '1']], 'g')],
    [pax([['comment', 'first']]), pax([['mtime', '1700000000']])],
    [pax([['mtime', '1700000000']]), longName()],
    [longName(), pax([['mtime', '1700000000']])],
    [pax([['mtime', '1700000000']]), pax([['uid', '42']], 'g')],
    [longName(), pax([['uid', '42']], 'g')],
  ]) {
    context.write([...metadata, entry(pathname, 'a')]);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([[pathname, 'file', 1]])),
    );
  }
});

test('malformed PAX lengths, duplicate keys, invalid UTF-8 and dangling metadata are refused', async t => {
  const context = fixture(t);
  const good = paxRecord('path', 'server/data/Один.json');
  const wrongByteLength = Buffer.from(good);
  wrongByteLength[0] = wrongByteLength[0] === 0x39 ? 0x38 : wrongByteLength[0] + 1;
  const invalidUtf8 = paxRecord('comment', 'x');
  invalidUtf8[invalidUtf8.length - 2] = 0xff;
  const maskedKeyword = paxRecord('path', 'server/data/one.json');
  const keywordOffset = maskedKeyword.indexOf(32) + 1;
  for (let index = keywordOffset; index < keywordOffset + 4; index += 1)
    maskedKeyword[index] |= 0x80;
  for (const parts of [
    [entry('PaxHeader', wrongByteLength, { type: 'x' }), entry('server/data/one.json')],
    [
      pax([
        ['path', 'one'],
        ['path', 'two'],
      ]),
      entry('server/data/one.json'),
    ],
    [entry('PaxHeader', invalidUtf8, { type: 'x' }), entry('server/data/one.json')],
    [entry('PaxHeader', maskedKeyword, { type: 'x' }), entry('../escape.json')],
    [pax([['path', 'server/data/one.json']])],
    [entry('././@LongLink', Buffer.from('server/data/one.json'), { type: 'L' })],
  ]) {
    context.write(parts);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([['server/data/one.json']])),
    );
  }
});

test('corrupt checksums, undecodable ordinary paths and malformed numeric fields are rejected', async t => {
  const context = fixture(t);
  const badChecksum = header({ name: 'server/data/one.json' });
  badChecksum[0] ^= 1;
  const invalidPath = header({ rawName: Buffer.from([0xff, 0xfe]) });
  const invalidSize = header({ name: 'server/data/one.json' });
  invalidSize.fill(0x39, 124, 135);
  checksum(invalidSize);
  for (const bytes of [badChecksum, invalidPath, invalidSize]) {
    context.write([bytes]);
    await assert.rejects(
      checkBackupArchiveInventory(context.archivePath, expected([['server/data/one.json']])),
    );
  }
  const maskedSize = entry('server/data/one.json', 'a');
  maskedSize[134] |= 0x80;
  checksum(maskedSize.subarray(0, BLOCK_SIZE));
  context.write([maskedSize]);
  await assert.rejects(
    checkBackupArchiveInventory(
      context.archivePath,
      expected([['server/data/one.json', 'file', 1]]),
    ),
  );
});

test('truncated headers/payloads, missing terminators and nonzero trailers cannot validate', async t => {
  const context = fixture(t);
  const inventory = expected([['server/data/one.json', 'file', 1]]);
  for (const [parts, ending] of [
    [[header({ name: 'server/data/one.json' }).subarray(0, 100)], Buffer.alloc(0)],
    [[header({ name: 'server/data/one.json', size: 1024 }), Buffer.from('a')], Buffer.alloc(0)],
    [[entry('server/data/one.json', 'a')], Buffer.alloc(0)],
    [[entry('server/data/one.json', 'a')], Buffer.alloc(BLOCK_SIZE)],
    [[entry('server/data/one.json', 'a')], Buffer.concat([ZERO_BLOCKS, Buffer.from('nonzero')])],
  ]) {
    context.write(parts, { ending });
    await assert.rejects(checkBackupArchiveInventory(context.archivePath, inventory));
  }
  context.write([entry('server/data/one.json', 'a')]);
  fs.writeFileSync(context.archivePath, fs.readFileSync(context.archivePath).subarray(0, 12));
  await assert.rejects(checkBackupArchiveInventory(context.archivePath, inventory));
});

test('metadata allocations are bounded and file payloads can cross many stream chunks', async t => {
  const context = fixture(t);
  context.write([header({ name: 'PaxHeader', type: 'x', size: 1024 * 1024 + 1 })]);
  await assert.rejects(
    checkBackupArchiveInventory(context.archivePath, expected([['server/data/one.json']])),
  );
  const body = Buffer.alloc(3 * 1024 * 1024 + 17, 0xa5);
  context.write([entry('server/uploads/large.bin', body)]);
  await checkBackupArchiveInventory(
    context.archivePath,
    expected([['server/uploads/large.bin', 'file', body.length]]),
  );
});
