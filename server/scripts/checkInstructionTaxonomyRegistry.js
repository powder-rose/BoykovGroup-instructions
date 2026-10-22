import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { getLegacyInstructionTaxonomyCatalog } from '../src/services/instructionTaxonomySource.js';

export function checkInstructionTaxonomyRegistry(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: { file: { type: 'string' }, help: { type: 'boolean', default: false } },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/checkInstructionTaxonomyRegistry.js [--file REGISTRY.json]\n' +
        'Validate and summarize the registry without writing files. Missing storage uses the committed seed.',
    );
    return null;
  }
  const repository = createInstructionTaxonomyRegistryRepository(
    values.file ? { filePath: values.file } : {},
  );
  const state = repository.read();
  const legacy = getLegacyInstructionTaxonomyCatalog();
  const entities = [state.root, ...state.catalogs, ...state.sections, ...state.tags];
  const report = {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    counts: {
      catalogs: state.catalogs.length,
      sections: state.sections.length,
      tags: state.tags.length,
      drafts: entities.filter(item => item.status === 'draft').length,
      published: entities.filter(item => item.status === 'published').length,
      indexingEnabled: entities.filter(item => item.indexingEnabled).length,
      legacyCategories: legacy.categories.length,
      legacyTags: legacy.tags.length,
    },
    pendingCatalogRoutes: state.catalogs.filter(item => !item.routeApproved).map(item => item.code),
    sourceIssues: state.sourceIssues,
    scope: 'registry-validation',
    writesPerformed: false,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkInstructionTaxonomyRegistry();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
