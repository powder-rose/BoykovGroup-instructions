import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, TextDecoder } from 'node:util';

import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import {
  applyInstructionTaxonomyPublication,
  buildInstructionTaxonomyPublication,
} from '../src/services/instructionTaxonomyPublication.js';

const DEFAULT_FILE = fileURLToPath(new URL('../data/instruction-taxonomy.json', import.meta.url));

function readPlan(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
    throw new Error('Plan must be a regular file of at most 32 MiB');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)));
}

export function publishInstructionTaxonomy(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      file: { type: 'string', default: DEFAULT_FILE },
      'output-dir': { type: 'string' },
      'apply-plan': { type: 'string' },
      'rollback-plan': { type: 'string' },
      'writers-stopped': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/publishInstructionTaxonomy.js [--file REGISTRY.json] --output-dir NEW_DIRECTORY\n' +
        'Apply: --apply-plan PLAN.json --writers-stopped\nRollback: --rollback-plan PLAN.json --writers-stopped\n' +
        'Preview never writes the source. Publishes the initial 2 catalogs, 52 sections and 79 tags; new pages remain noindex. No instruction reads or writes, no application startup.',
    );
    return null;
  }
  const modes = [values['output-dir'], values['apply-plan'], values['rollback-plan']].filter(
    Boolean,
  );
  if (modes.length !== 1)
    throw new Error('Choose exactly one preview, apply or rollback operation');
  const requested = path.resolve(values.file);
  const parent = fs.realpathSync(path.dirname(requested));
  const file = path.join(parent, path.basename(requested));
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024)
      throw new Error('Registry must be a regular file of at most 16 MiB');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const repository = createInstructionTaxonomyRegistryRepository({ filePath: file });
  if (values['output-dir']) {
    const requestedOutput = path.resolve(values['output-dir']);
    const output = path.join(
      fs.realpathSync(path.dirname(requestedOutput)),
      path.basename(requestedOutput),
    );
    const relative = path.relative(parent, output);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw new Error('Output must be outside the registry directory');
    }
    const plan = buildInstructionTaxonomyPublication(repository.read());
    fs.mkdirSync(output, { mode: 0o700 });
    fs.writeFileSync(path.join(output, 'publication.json'), JSON.stringify(plan, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    fs.writeFileSync(
      path.join(output, 'registry-before.json'),
      JSON.stringify(plan.before, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(output, 'registry-after.json'),
      JSON.stringify(plan.after, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(output, 'urls.txt'),
      plan.urls
        .map(
          item =>
            `${item.code}\t${item.path}\t${item.status}\t${item.indexingEnabled ? 'indexing-enabled' : 'noindex'}`,
        )
        .join('\n') + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    const result = {
      status: 'preview',
      outputDirectory: output,
      registryFile: file,
      revision: plan.before.revision,
      changes: plan.changes.length,
      urls: plan.urls.length,
      writesToSource: false,
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  if (!values['writers-stopped'])
    throw new Error('Stop all registry writers and acknowledge --writers-stopped');
  const rollback = Boolean(values['rollback-plan']);
  const plan = readPlan(values['rollback-plan'] || values['apply-plan']);
  const state = applyInstructionTaxonomyPublication(repository, plan, { rollback });
  const result = {
    status: rollback ? 'rolled-back' : 'published',
    registryFile: file,
    revision: state.revision,
    changedEntities: plan.changes.length,
    instructionWrites: 0,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    publishInstructionTaxonomy();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
