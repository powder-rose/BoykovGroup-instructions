import { constants, createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';

const BLOCK_SIZE = 512;
const MAX_METADATA_SIZE = 1024 * 1024;
const MAX_METADATA_TOTAL = 64 * 1024 * 1024;
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const PAX_KEYS = new Set([
  'path',
  'size',
  'linkpath',
  'mtime',
  'atime',
  'ctime',
  'uid',
  'gid',
  'uname',
  'gname',
  'comment',
  'charset',
  'hdrcharset',
  'LIBARCHIVE.creationtime',
  'SCHILY.fflags',
  'SCHILY.dev',
  'SCHILY.ino',
  'SCHILY.nlink',
]);

function invalid(message) {
  return new Error(`Invalid backup archive: ${message}`);
}

function zeros(bytes) {
  return bytes.every(value => value === 0);
}

function text(bytes) {
  const end = bytes.indexOf(0);
  return UTF8.decode(end < 0 ? bytes : bytes.subarray(0, end));
}

function ascii(bytes) {
  if (bytes.some(byte => byte > 127)) throw invalid('non-ASCII structural field');
  return bytes.toString('ascii');
}

function number(bytes) {
  let value;
  if (bytes[0] & 0x80) {
    if (bytes[0] & 0x40) throw invalid('negative member size');
    value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.subarray(1)) value = value * 256n + BigInt(byte);
  } else {
    const field = ascii(bytes).replace(/\0.*$/u, '').trim();
    if (!/^[0-7]+$/u.test(field)) throw invalid('malformed numeric header field');
    value = BigInt(`0o${field}`);
  }
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid('member size exceeds safe range');
  return Number(value);
}

function header(bytes) {
  const stored = number(bytes.subarray(148, 156));
  const calculated = bytes.reduce(
    (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
    0,
  );
  if (stored !== calculated) throw invalid('header checksum mismatch');
  const magic = bytes.subarray(257, 263);
  const version = bytes.subarray(263, 265);
  const posix = magic.equals(Buffer.from('ustar\0')) && version.equals(Buffer.from('00'));
  const gnu = magic.equals(Buffer.from('ustar ')) && version.equals(Buffer.from(' \0'));
  if (!posix && !gnu && !zeros(bytes.subarray(257))) throw invalid('unsupported header format');
  return {
    name: bytes.subarray(0, 100),
    prefix: posix ? bytes.subarray(345, 500) : Buffer.alloc(0),
    size: number(bytes.subarray(124, 136)),
    type: bytes[156] === 0 ? '0' : String.fromCharCode(bytes[156]),
    linked: !zeros(bytes.subarray(157, 257)),
  };
}

function safePath(value, kind) {
  if (kind === 'directory') value = value.replace(/\/$/u, '');
  if (
    !value ||
    value.startsWith('/') ||
    /^[a-z]:/iu.test(value) ||
    value.includes('\\') ||
    [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    value.split('/').some(part => !part || part === '.' || part === '..')
  )
    throw new Error('Generated backup contains an unsafe archive member');
  return value;
}

function pax(bytes) {
  const values = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space < 0 || space - offset > 10) throw invalid('malformed PAX record length');
    const digits = ascii(bytes.subarray(offset, space));
    if (!/^[1-9]\d*$/u.test(digits)) throw invalid('malformed PAX record length');
    const length = Number(digits);
    const end = offset + length;
    if (
      !Number.isSafeInteger(length) ||
      end > bytes.length ||
      end <= space + 2 ||
      bytes[end - 1] !== 10
    )
      throw invalid('truncated or malformed PAX record');
    const body = bytes.subarray(space + 1, end - 1);
    const equals = body.indexOf(61);
    if (equals < 1) throw invalid('PAX record has no keyword');
    const key = ascii(body.subarray(0, equals));
    if (!/^[a-z\d_.-]+$/iu.test(key) || values.has(key))
      throw invalid('invalid or duplicate PAX keyword');
    if (
      !PAX_KEYS.has(key) &&
      !/^SCHILY\.(?:acl\.|xattr\.)/u.test(key) &&
      !/^LIBARCHIVE\.xattr\./u.test(key)
    )
      throw invalid(`unsupported PAX keyword: ${key}`);
    const value = UTF8.decode(body.subarray(equals + 1));
    if (key === 'linkpath')
      throw new Error('Generated backup contains a link or unsupported archive member type');
    if (key === 'hdrcharset' && value && !['UTF-8', 'ISO-IR 10646 2000 UTF-8'].includes(value))
      throw invalid('unsupported PAX header character set');
    values.set(key, value);
    offset = end;
  }
  return values;
}

function merged(global, local) {
  const result = new Map(global);
  for (const [key, value] of local) {
    if (value === '') result.delete(key);
    else result.set(key, value);
  }
  return result;
}

function paxSize(value) {
  if (!/^\d+$/u.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER))
    throw invalid('invalid PAX member size');
  return Number(value);
}

function reader(stream, budget) {
  const iterator = stream[Symbol.asyncIterator]();
  let chunk = Buffer.alloc(0);
  let offset = 0;
  let expanded = 0n;
  async function available() {
    while (offset === chunk.length) {
      const next = await iterator.next();
      if (next.done) return false;
      chunk = Buffer.from(next.value);
      offset = 0;
      expanded += BigInt(chunk.length);
      if (expanded > budget) throw invalid('expanded archive exceeds inventory budget');
    }
    return true;
  }
  return {
    async read(length, optional = false) {
      const output = Buffer.allocUnsafe(length);
      let written = 0;
      while (written < length) {
        if (!(await available())) {
          if (optional && written === 0) return null;
          throw invalid('truncated archive');
        }
        const count = Math.min(length - written, chunk.length - offset);
        chunk.copy(output, written, offset, offset + count);
        written += count;
        offset += count;
      }
      return output;
    },
    async skip(length) {
      while (length > 0) {
        if (!(await available())) throw invalid('truncated member payload');
        const count = Math.min(length, chunk.length - offset);
        offset += count;
        length -= count;
      }
    },
    async finish() {
      let trailing = 0;
      while (await available()) {
        const rest = chunk.subarray(offset);
        if (!zeros(rest)) throw invalid('nonzero bytes after archive terminator');
        trailing += rest.length;
        offset = chunk.length;
      }
      if (trailing % BLOCK_SIZE !== 0) throw invalid('unaligned archive trailer');
    },
  };
}

export async function checkBackupArchiveInventory(archivePath, sourceInventory) {
  if (!Array.isArray(sourceInventory?.entries))
    throw new TypeError('Source inventory entries are required');
  const expected = new Map();
  let dataBudget = 0n;
  for (const entry of sourceInventory.entries) {
    if (
      !['file', 'directory'].includes(entry.kind) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      (entry.kind === 'directory' && entry.size !== 0)
    )
      throw new TypeError('Invalid source inventory entry');
    const name = safePath(entry.path, entry.kind);
    if (name !== entry.path || expected.has(name))
      throw new TypeError('Source inventory paths must be unique and normalized');
    expected.set(name, entry);
    dataBudget +=
      BigInt(Math.ceil(entry.size / BLOCK_SIZE)) * BigInt(BLOCK_SIZE) + BigInt(BLOCK_SIZE);
  }
  if (!(await lstat(archivePath)).isFile()) throw invalid('archive must be a regular file');
  const input = createReadStream(archivePath, {
    flags: constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
  });
  const stream = createGunzip();
  input.on('error', error => stream.destroy(error));
  input.pipe(stream);
  const metadataBudget = Math.min(
    MAX_METADATA_TOTAL,
    Math.max(4 * 1024 * 1024, expected.size * 8192),
  );
  const archive = reader(stream, dataBudget + BigInt(metadataBudget) + 4n * 1024n * 1024n);
  const seen = new Set();
  const global = new Map();
  let local = new Map();
  let localPending = false;
  let longName = null;
  let metadataTotal = 0;
  let headers = 0;
  try {
    while (true) {
      const bytes = await archive.read(BLOCK_SIZE, true);
      if (!bytes) throw invalid('missing archive terminator');
      if (zeros(bytes)) {
        if (!zeros(await archive.read(BLOCK_SIZE))) throw invalid('incomplete archive terminator');
        if (localPending || longName !== null) throw invalid('dangling extended header');
        await archive.finish();
        break;
      }
      headers += 1;
      if (headers > expected.size * 4 + 32) throw invalid('too many archive headers');
      const item = header(bytes);
      if (item.linked)
        throw new Error('Generated backup contains a link or unsupported archive member type');
      if (['x', 'g', 'L'].includes(item.type)) {
        if (localPending || longName !== null) throw invalid('ambiguous extended header sequence');
        metadataTotal += item.size;
        if (item.size > MAX_METADATA_SIZE || metadataTotal > metadataBudget)
          throw invalid('extended metadata exceeds verification limit');
        const body = await archive.read(item.size);
        if (item.type === 'L') {
          if (
            longName !== null ||
            !body.length ||
            body.at(-1) !== 0 ||
            body.subarray(0, -1).includes(0)
          )
            throw invalid('malformed GNU long filename');
          longName = UTF8.decode(body.subarray(0, -1));
        } else {
          const values = pax(body);
          if (item.type === 'g') {
            if (values.has('path') || values.has('size'))
              throw invalid('unsupported global PAX path or size');
            for (const [key, value] of values) {
              if (value === '') global.delete(key);
              else global.set(key, value);
            }
          } else {
            for (const [key, value] of values) local.set(key, value);
            localPending = true;
          }
        }
        const padding = (BLOCK_SIZE - (item.size % BLOCK_SIZE)) % BLOCK_SIZE;
        if (!zeros(await archive.read(padding))) throw invalid('nonzero metadata padding');
        continue;
      }
      if (!['0', '5'].includes(item.type))
        throw new Error('Generated backup contains a link or unsupported archive member type');
      const overrides = merged(global, local);
      if (longName !== null && overrides.has('path'))
        throw invalid('ambiguous filename extensions');
      const prefix = overrides.has('path') || longName !== null ? '' : text(item.prefix);
      const rawName =
        overrides.get('path') ?? longName ?? `${prefix ? `${prefix}/` : ''}${text(item.name)}`;
      const kind = item.type === '5' ? 'directory' : 'file';
      const name = safePath(rawName, kind);
      const size = overrides.has('size') ? paxSize(overrides.get('size')) : item.size;
      const original = expected.get(name);
      if (!original || seen.has(name) || original.kind !== kind || original.size !== size)
        throw new Error('Generated archive membership does not match the source inventory');
      seen.add(name);
      local = new Map();
      localPending = false;
      longName = null;
      await archive.skip(size);
      const padding = (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
      if (!zeros(await archive.read(padding))) throw invalid('nonzero member padding');
    }
    if (seen.size !== expected.size)
      throw new Error('Generated archive membership does not match the source inventory');
  } finally {
    input.destroy();
    stream.destroy();
  }
}
