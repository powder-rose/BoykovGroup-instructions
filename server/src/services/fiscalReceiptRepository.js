import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  acquireFileLeaseLock,
  releaseFileLeaseLock,
  startFileLeaseHeartbeat,
  refreshFileLeaseLock,
} from '../utils/fileLeaseLock.js';
import { fiscalError } from './fiscalReceiptPayload.js';

const DIRECTORY = fileURLToPath(new URL('../../data/fiscal-receipts', import.meta.url));
const STATES = new Set(['pending', 'sending', 'submitted', 'processed', 'review']);
const fingerprint = event => createHash('sha256').update(JSON.stringify(event)).digest('hex');

export function createFiscalReceiptRepository({ directory = DIRECTORY } = {}) {
  const registryFile = path.join(directory, '_registry.json');
  const marker = `${directory}.initialized`;
  function filename(id) {
    if (!/^[a-f0-9]{64}$/u.test(id)) throw fiscalError('FISCAL_ID_INVALID');
    return path.join(directory, `${id}.json`);
  }
  function ensureDirectory() {
    if (fs.existsSync(marker) && (!fs.existsSync(directory) || !fs.existsSync(registryFile)))
      throw fiscalError('FISCAL_REGISTRY_MISSING');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(directory).isDirectory()) throw fiscalError('FISCAL_STORAGE_INVALID');
    if (
      !fs.existsSync(registryFile) &&
      fs.readdirSync(directory).some(name => /^[a-f0-9]{64}\.json$/u.test(name))
    )
      throw fiscalError('FISCAL_REGISTRY_MISSING');
    if (process.platform !== 'win32') fs.chmodSync(directory, 0o700);
  }
  function syncDirectory(target) {
    if (process.platform === 'win32') return;
    const descriptor = fs.openSync(target, 'r');
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  function registry() {
    if (!fs.existsSync(registryFile)) return [];
    if (!fs.lstatSync(registryFile).isFile()) throw fiscalError('FISCAL_STORAGE_INVALID');
    const ids = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    if (
      !Array.isArray(ids) ||
      ids.some(id => !/^[a-f0-9]{64}$/u.test(id)) ||
      new Set(ids).size !== ids.length
    )
      throw fiscalError('FISCAL_STORAGE_INVALID');
    return ids;
  }
  function atomicWrite(file, value) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify(value)}\n`, 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporary, file);
      syncDirectory(directory);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== 'ENOENT')
          console.error('[FiscalReceipt] temporary cleanup failed', error.code);
      }
    }
  }
  function read(id) {
    const file = filename(id);
    try {
      if (!fs.lstatSync(file).isFile()) throw fiscalError('FISCAL_STORAGE_INVALID');
      const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (
        entry.event?.id !== id ||
        entry.fingerprint !== fingerprint(entry.event) ||
        !STATES.has(entry.status) ||
        !Number.isInteger(entry.attempts) ||
        entry.attempts < 0 ||
        (entry.status === 'submitted' && typeof entry.receiptId !== 'string')
      )
        throw fiscalError('FISCAL_STORAGE_INVALID');
      return entry;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  function write(entry) {
    atomicWrite(filename(entry.event.id), entry);
  }
  return {
    read,
    list() {
      try {
        if (fs.existsSync(marker) && !fs.existsSync(registryFile))
          throw fiscalError('FISCAL_REGISTRY_MISSING');
        if (
          !fs.existsSync(registryFile) &&
          fs.existsSync(directory) &&
          fs.readdirSync(directory).some(name => /^[a-f0-9]{64}\.json$/u.test(name))
        )
          throw fiscalError('FISCAL_REGISTRY_MISSING');
        const ids = registry();
        const entries = ids.map(id => read(id));
        if (entries.some(entry => !entry)) throw fiscalError('FISCAL_RECEIPT_RECORD_MISSING');
        return entries;
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    },
    async withEvent(event, action) {
      ensureDirectory();
      const lock = acquireFileLeaseLock({
        filePath: `${filename(event.id)}.lock`,
        staleMs: 120000,
      });
      if (!lock.acquired) return;
      let lostLease = false;
      const stopHeartbeat = startFileLeaseHeartbeat(lock, {
        intervalMs: 10000,
        onError: () => {
          lostLease = true;
        },
      });
      try {
        let entry = read(event.id);
        if (entry && entry.fingerprint !== fingerprint(event))
          throw fiscalError('FISCAL_SOURCE_CHANGED');
        const save = value => {
          if (lostLease || !refreshFileLeaseLock(lock)) throw fiscalError('FISCAL_LEASE_LOST');
          write(value);
        };
        const registryLock = acquireFileLeaseLock({
          filePath: `${registryFile}.lock`,
          staleMs: 300000,
        });
        if (!registryLock.acquired) return;
        try {
          const ids = registry();
          if (ids.includes(event.id) && !entry) throw fiscalError('FISCAL_RECEIPT_RECORD_MISSING');
          if (!entry) {
            entry = { event, fingerprint: fingerprint(event), status: 'pending', attempts: 0 };
            save(entry);
          }
          if (!ids.includes(event.id)) atomicWrite(registryFile, [...ids, event.id]);
          if (!fs.existsSync(marker)) {
            const descriptor = fs.openSync(marker, 'wx', 0o600);
            try {
              fs.writeFileSync(descriptor, '1\n');
              fs.fsyncSync(descriptor);
            } finally {
              fs.closeSync(descriptor);
            }
            syncDirectory(path.dirname(marker));
          }
        } finally {
          releaseFileLeaseLock(registryLock);
        }
        return await action(entry, save);
      } finally {
        stopHeartbeat();
        releaseFileLeaseLock(lock);
      }
    },
  };
}
