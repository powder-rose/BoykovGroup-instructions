import fs from 'node:fs';
import path from 'node:path';

const STRING_FIELDS = ['id', 'title', 'profession', 'slug', 'source', 'status', 'seoStatus'];
const DATE_FIELDS = [
  'publishedAt',
  'createdAt',
  'generatedAt',
  'uploadedAt',
  'updatedAt',
  'modifiedAt',
];

export function instructionFileSignature(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}

function referenceOf(record) {
  for (const field of ['title', 'slug']) {
    if (
      record[field] !== undefined &&
      record[field] !== null &&
      typeof record[field] !== 'string'
    ) {
      throw new TypeError(`Invalid instruction ${field}`);
    }
  }
  const reference = {};
  for (const field of STRING_FIELDS) {
    if (typeof record[field] === 'string' || record[field] === null)
      reference[field] = record[field];
  }
  for (const field of DATE_FIELDS) {
    if (['string', 'number'].includes(typeof record[field]) || record[field] === null) {
      reference[field] = record[field];
    }
  }
  if (typeof record.revision === 'number') reference.revision = record.revision;
  if (record.primaryCategoryId !== undefined)
    reference.primaryCategoryId = record.primaryCategoryId;
  if (record.tagIds !== undefined) reference.tagIds = structuredClone(record.tagIds);
  if (record.slugAliases !== undefined && record.slugAliases !== null) {
    if (
      !Array.isArray(record.slugAliases) ||
      record.slugAliases.some(alias => typeof alias !== 'string')
    ) {
      throw new TypeError('Invalid instruction slug aliases');
    }
    reference.slugAliases = [...record.slugAliases];
  }
  return reference;
}

function filesIn(directory) {
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.name.endsWith('.json'))
    .sort((first, second) => first.name.localeCompare(second.name));
  if (entries.some(entry => !entry.isFile())) throw new Error('Non-regular instruction entry');
  return entries.map(entry => entry.name);
}

export function createInstructionPublicIndex({ directory, readInstruction }) {
  let entries = new Map();

  return {
    reset() {
      entries = new Map();
    },
    invalidate(fileName) {
      entries.delete(fileName);
    },
    refresh(cache) {
      const directoryStat = fs.lstatSync(directory, { bigint: true });
      if (!directoryStat.isDirectory()) throw new Error('Non-regular instruction directory');
      const files = filesIn(directory);
      const nextEntries = new Map();
      const nextCache = new Map();
      const ids = new Set();

      for (const fileName of files) {
        const file = path.join(directory, fileName);
        const stat = fs.lstatSync(file, { bigint: true });
        if (!stat.isFile()) throw new Error('Non-regular instruction file');
        const signature = instructionFileSignature(stat);
        const previous = entries.get(fileName);
        let entry;
        let record;

        if (previous?.signature === signature && cache.has(previous.id)) {
          entry = previous;
          record = cache.get(previous.id);
        } else {
          const snapshot = readInstruction(file, { verifyUnchanged: true });
          if (instructionFileSignature(fs.lstatSync(file, { bigint: true })) !== signature) {
            throw new Error('Instruction changed while reading');
          }
          record = snapshot.record;
          entry = { id: snapshot.id, signature, reference: referenceOf(record) };
        }

        if (ids.has(entry.id)) throw new Error('Duplicate instruction ID');
        ids.add(entry.id);
        nextEntries.set(fileName, entry);
        nextCache.set(entry.id, record);
      }

      const currentDirectory = fs.lstatSync(directory, { bigint: true });
      if (
        !currentDirectory.isDirectory() ||
        currentDirectory.dev !== directoryStat.dev ||
        currentDirectory.ino !== directoryStat.ino ||
        JSON.stringify(filesIn(directory)) !== JSON.stringify(files)
      ) {
        throw new Error('Instruction directory changed while reading');
      }

      const references = structuredClone([...nextEntries.values()].map(entry => entry.reference));
      entries = nextEntries;
      return { references, cache: nextCache };
    },
  };
}
