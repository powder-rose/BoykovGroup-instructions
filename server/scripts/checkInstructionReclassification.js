import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, TextDecoder } from 'node:util';

import {
  buildInstructionReclassificationReport,
  parseReclassificationCsv,
} from '../src/services/instructionReclassificationPreflight.js';

const DEFAULT_DICTIONARY = fileURLToPath(
  new URL('../../docs/reclassification/source-catalog.json', import.meta.url),
);
const IMPORT_COLUMNS = [
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
const REVIEW_COLUMNS = ['ID', 'URL', 'Стало ID', 'Стало название'];
const CHANGE_COLUMNS = [...REVIEW_COLUMNS, 'Было ID', 'Было название', 'Каталог'];

function readInput(file) {
  const absolute = path.resolve(file);
  if (!fs.lstatSync(absolute).isFile()) {
    throw new Error(`Input must be a regular file, not a link: ${absolute}`);
  }
  const bytes = fs.readFileSync(absolute);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return {
    text,
    file: absolute,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function readReclassificationInstructions(directory) {
  const absolute = path.resolve(directory);
  if (!fs.lstatSync(absolute).isDirectory()) {
    throw new Error('Instruction snapshot must be a real directory, not a link');
  }
  const files = fs
    .readdirSync(absolute)
    .filter(file => file.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error('No instruction JSON files in the supplied snapshot');

  const fingerprints = [];
  const instructions = files.map(file => {
    const input = readInput(path.join(absolute, file));
    const instruction = JSON.parse(input.text);
    if (!instruction || Array.isArray(instruction) || typeof instruction !== 'object') {
      throw new Error(`Invalid instruction object: ${file}`);
    }
    if (typeof instruction.id !== 'string' || !instruction.id.trim()) {
      throw new Error(`Missing instruction ID: ${file}`);
    }
    if (
      (instruction.slug !== undefined &&
        instruction.slug !== null &&
        typeof instruction.slug !== 'string') ||
      (instruction.slugAliases !== undefined &&
        instruction.slugAliases !== null &&
        (!Array.isArray(instruction.slugAliases) ||
          instruction.slugAliases.some(alias => typeof alias !== 'string' || !alias.trim())))
    ) {
      throw new Error(`Invalid instruction URL fields: ${file}`);
    }
    fingerprints.push({ file, sha256: input.sha256 });
    return instruction;
  });
  return { instructions, fingerprints, directory: fs.realpathSync(absolute) };
}

function assertReportLocation(output, instructionDirectory) {
  const absolute = path.resolve(output);
  const parent = fs.realpathSync(path.dirname(absolute));
  const canonical = path.join(parent, path.basename(absolute));
  if (instructionDirectory) {
    const relative = path.relative(instructionDirectory, canonical);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw new Error('Report must be outside the instruction snapshot');
    }
  }
  return canonical;
}

export function checkInstructionReclassification(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      import: { type: 'string' },
      manual: { type: 'string' },
      changed: { type: 'string' },
      dictionary: { type: 'string', default: DEFAULT_DICTIONARY },
      directory: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/checkInstructionReclassification.js ' +
        '--import IMPORT.csv --manual CHECK.csv --changed CHANGED.csv ' +
        '[--dictionary SOURCE.json] [--directory INSTRUCTION_SNAPSHOT] [--output NEW_REPORT.json]\n' +
        'Read-only preflight. Without --directory, only supplied sources are checked. ' +
        'No application mode is implemented. Output, when supplied, must be a new file outside the snapshot.',
    );
    return null;
  }
  for (const key of ['import', 'manual', 'changed']) {
    if (!values[key]) throw new Error(`--${key} is required`);
  }

  const inputs = Object.fromEntries(
    ['import', 'manual', 'changed', 'dictionary'].map(key => [key, readInput(values[key])]),
  );
  const snapshot = values.directory ? readReclassificationInstructions(values.directory) : null;
  const report = {
    ...buildInstructionReclassificationReport({
      importRows: parseReclassificationCsv(inputs.import.text, { requiredColumns: IMPORT_COLUMNS }),
      manualRows: parseReclassificationCsv(inputs.manual.text, { requiredColumns: REVIEW_COLUMNS }),
      changedRows: parseReclassificationCsv(inputs.changed.text, {
        requiredColumns: CHANGE_COLUMNS,
      }),
      dictionary: JSON.parse(inputs.dictionary.text),
      instructions: snapshot?.instructions ?? null,
    }),
    createdAt: new Date().toISOString(),
    inputs: Object.fromEntries(
      Object.entries(inputs).map(([key, { file, sha256 }]) => [key, { file, sha256 }]),
    ),
    snapshot: snapshot ? { directory: snapshot.directory, files: snapshot.fingerprints } : null,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (values.output) {
    const output = assertReportLocation(values.output, snapshot?.directory);
    fs.writeFileSync(output, json, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    console.log(
      JSON.stringify(
        {
          report: output,
          mode: report.mode,
          applySupported: false,
          counts: report.counts,
          errors: report.errors.length,
          dictionaryIssues: report.dictionaryIssues,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(json);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = checkInstructionReclassification();
    if (report?.errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
