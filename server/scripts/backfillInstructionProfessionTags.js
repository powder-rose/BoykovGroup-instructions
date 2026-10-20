import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { planInstructionProfessionTags } from '../src/services/instructionProfessionTagBackfill.js';
import { getInstructionTaxonomyCatalog } from '../src/services/instructionTaxonomyService.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const accessOf = stat => ({ mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid });

function instructionFiles(directory) {
  if (!fs.lstatSync(directory).isDirectory()) {
    throw new Error('Instructions must be in a real directory');
  }
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => {
      if (!entry.name.endsWith('.json')) return false;
      if (!entry.isFile()) throw new Error(`Non-regular JSON entry: ${entry.name}`);
      return true;
    })
    .map(entry => entry.name)
    .sort();
}

function readRegularFile(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile()) throw new Error(`Non-regular instruction: ${path.basename(file)}`);
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`Instruction changed while reading: ${path.basename(file)}`);
    }
    return { bytes, ...accessOf(after) };
  } finally {
    fs.closeSync(fd);
  }
}

function syncDirectory(directory) {
  const fd = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function writeNew(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function atomicReplace(directory, row, bytes) {
  const temporary = path.join(directory, `.${row.file}.${randomBytes(12).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fchownSync(fd, row.uid, row.gid);
    fs.fchmodSync(fd, row.mode);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, path.join(directory, row.file));
    syncDirectory(directory);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function createProfessionTagBackfillPlan(directoryArgument) {
  const supplied = path.resolve(directoryArgument);
  const files = instructionFiles(supplied);
  const directory = fs.realpathSync(supplied);
  const ids = new Set();
  const counts = { change: 0, unchanged: 0, manual: 0, 'unknown-source': 0, limit: 0, invalid: 0 };

  const records = files.map(file => {
    const original = readRegularFile(path.join(directory, file));
    let instruction;
    try {
      instruction = JSON.parse(original.bytes.toString('utf8').replace(/^\uFEFF/u, ''));
    } catch {
      throw new Error(`Invalid instruction JSON: ${file}`);
    }
    const proposal = planInstructionProfessionTags(instruction);
    if (instruction?.id && ids.has(instruction.id)) {
      throw new Error(`Duplicate instruction ID: ${file}`);
    }
    if (instruction?.id) ids.add(instruction.id);
    counts[proposal.status]++;
    const candidate =
      proposal.status === 'change' ? jsonBytes(proposal.instruction) : original.bytes;

    return {
      file,
      id: instruction?.id ?? null,
      title: instruction?.title ?? null,
      status: proposal.status,
      addedTagIds: proposal.addedTagIds,
      ...(proposal.error && { error: proposal.error }),
      ...accessOf(original),
      originalSha256: sha256(original.bytes),
      candidateSha256: sha256(candidate),
      original: original.bytes,
      candidate,
    };
  });

  return { directory, catalogVersion: getInstructionTaxonomyCatalog().version, records, counts };
}

export function summarizeProfessionTagBackfill(plan) {
  return {
    directory: plan.directory,
    records: plan.records.length,
    counts: plan.counts,
    addedTags: plan.records.reduce((count, row) => count + row.addedTagIds.length, 0),
    affected: plan.records
      .filter(row => row.status !== 'unchanged')
      .map(({ file, id, title, status, addedTagIds, error }) => ({
        file,
        id,
        title,
        status,
        addedTagIds,
        ...(error && { error }),
      })),
  };
}

function verifyRow(plan, row, allowedHashes) {
  const current = readRegularFile(path.join(plan.directory, row.file));
  if (
    current.mode !== row.mode ||
    current.uid !== row.uid ||
    current.gid !== row.gid ||
    !allowedHashes.includes(sha256(current.bytes))
  ) {
    throw new Error(`Instruction snapshot changed: ${row.file}`);
  }
  return sha256(current.bytes);
}

function verifySnapshot(plan, state) {
  if (
    JSON.stringify(instructionFiles(plan.directory)) !==
    JSON.stringify(plan.records.map(row => row.file))
  ) {
    throw new Error('Instruction file set changed');
  }
  for (const row of plan.records) {
    const hashes =
      state === 'original'
        ? [row.originalSha256]
        : state === 'candidate'
          ? [row.candidateSha256]
          : [row.originalSha256, row.candidateSha256];
    verifyRow(plan, row, hashes);
  }
}

function backupSnapshot(plan, backupDirectory) {
  fs.mkdirSync(backupDirectory, { mode: 0o700 });
  const originals = path.join(backupDirectory, 'originals');
  const candidates = path.join(backupDirectory, 'candidates');
  fs.mkdirSync(originals, { mode: 0o700 });
  fs.mkdirSync(candidates, { mode: 0o700 });
  for (const row of plan.records) {
    if (
      sha256(row.original) !== row.originalSha256 ||
      sha256(row.candidate) !== row.candidateSha256
    ) {
      throw new Error(`Prepared bytes changed: ${row.file}`);
    }
    writeNew(path.join(originals, row.file), row.original);
    if (row.status === 'change') writeNew(path.join(candidates, row.file), row.candidate);
  }
  syncDirectory(originals);
  syncDirectory(candidates);
  writeNew(
    path.join(backupDirectory, 'manifest.json'),
    jsonBytes({
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      directory: plan.directory,
      catalogVersion: plan.catalogVersion,
      records: plan.records.map(({ original: _original, candidate: _candidate, ...row }) => row),
    }),
  );
  syncDirectory(backupDirectory);
  syncDirectory(path.dirname(backupDirectory));
}

function readBackupOriginal(backupDirectory, row) {
  const original = readRegularFile(path.join(backupDirectory, 'originals', row.file)).bytes;
  if (sha256(original) !== row.originalSha256) {
    throw new Error(`Original backup changed: ${row.file}`);
  }
  return original;
}

function rollback(plan, backupDirectory, attempted) {
  // Refuse the whole rollback before restoring anything if another writer changed the snapshot.
  verifySnapshot(plan, 'either');
  const originals = new Map(
    attempted.map(row => [row.file, readBackupOriginal(backupDirectory, row)]),
  );
  for (const row of [...attempted].reverse()) {
    const current = verifyRow(plan, row, [row.originalSha256, row.candidateSha256]);
    if (current === row.originalSha256) continue;
    atomicReplace(plan.directory, row, originals.get(row.file));
  }
  verifySnapshot(plan, 'original');
}

export function applyProfessionTagBackfill(plan, backupArgument) {
  if (!backupArgument) throw new Error('Apply requires a new backup directory');
  if (plan.counts.invalid)
    throw new Error('Invalid taxonomy records block apply; inspect the dry-run report');
  const supplied = path.resolve(backupArgument);
  const backupDirectory = path.join(
    fs.realpathSync(path.dirname(supplied)),
    path.basename(supplied),
  );
  const relative = path.relative(plan.directory, backupDirectory);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error('Backup directory must be outside the instructions directory');
  }
  if (fs.existsSync(backupDirectory)) throw new Error('Backup directory must not already exist');
  verifySnapshot(plan, 'original');
  if (!plan.counts.change) return { applied: 0, backupDirectory: null };

  const lockPath = path.join(plan.directory, '.profession-tags-backfill.lock');
  writeNew(lockPath, jsonBytes({ pid: process.pid, createdAt: new Date().toISOString() }));
  const attempted = [];
  try {
    backupSnapshot(plan, backupDirectory);
    for (const row of plan.records) readBackupOriginal(backupDirectory, row);
    verifySnapshot(plan, 'original');
    writeNew(
      path.join(backupDirectory, 'apply.started'),
      Buffer.from(`${new Date().toISOString()}\n`),
    );
    syncDirectory(backupDirectory);

    for (const row of plan.records) {
      if (row.status !== 'change') continue;
      verifyRow(plan, row, [row.originalSha256]);
      attempted.push(row);
      atomicReplace(plan.directory, row, row.candidate);
    }
    verifySnapshot(plan, 'candidate');
    const result = { applied: attempted.length, backupDirectory };
    writeNew(
      path.join(backupDirectory, 'completed.json'),
      jsonBytes({ ...result, completedAt: new Date().toISOString() }),
    );
    syncDirectory(backupDirectory);
    return result;
  } catch (error) {
    let rollbackStatus = 'not-needed';
    let rollbackError;
    if (attempted.length) {
      try {
        rollback(plan, backupDirectory, attempted);
        rollbackStatus = 'restored';
      } catch (restoreError) {
        rollbackStatus = 'blocked';
        rollbackError = restoreError.message;
      }
    }
    if (fs.existsSync(backupDirectory)) {
      try {
        const completedPath = path.join(backupDirectory, 'completed.json');
        if (fs.existsSync(completedPath)) fs.unlinkSync(completedPath);
        writeNew(
          path.join(backupDirectory, 'failed.json'),
          jsonBytes({ error: error.message, rollbackStatus, rollbackError }),
        );
        syncDirectory(backupDirectory);
      } catch {
        // Preserve the original failure even if the filesystem cannot write the failure record.
      }
    }
    throw new Error(
      `Backfill failed: ${error.message}. Rollback: ${rollbackStatus}${rollbackError ? ` (${rollbackError})` : ''}. Backup: ${backupDirectory}`,
      { cause: error },
    );
  } finally {
    fs.unlinkSync(lockPath);
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      directory: { type: 'string' },
      backup: { type: 'string' },
      apply: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/backfillInstructionProfessionTags.js --directory INSTRUCTIONS [--apply --backup NEW_DIRECTORY]\n' +
        'Dry-run is the default and writes nothing. Stop the API and all instruction writers before --apply; restart the API afterwards to reload its cache.\n' +
        'Existing categories and tags are preserved. Manual tags, unknown provenance and full selections are skipped. Apply creates a complete private backup before changing files.',
    );
    return;
  }
  if (!values.directory) throw new Error('--directory is required');
  if (!values.apply && values.backup) throw new Error('--backup is only valid with --apply');
  const plan = createProfessionTagBackfillPlan(values.directory);
  console.log(
    JSON.stringify(
      { mode: values.apply ? 'apply' : 'dry-run', ...summarizeProfessionTagBackfill(plan) },
      null,
      2,
    ),
  );
  if (values.apply)
    console.log(JSON.stringify(applyProfessionTagBackfill(plan, values.backup), null, 2));
  else if (plan.counts.invalid) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
