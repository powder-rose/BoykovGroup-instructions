import fs from 'node:fs';

const source = JSON.parse(
  fs.readFileSync(new URL('../data/instructionTaxonomyCatalog.json', import.meta.url), 'utf8'),
);
const { registrySeed, ...legacyCatalog } = source;

if (
  !Array.isArray(legacyCatalog.categories) ||
  !Array.isArray(legacyCatalog.tags) ||
  !registrySeed ||
  typeof registrySeed !== 'object' ||
  Array.isArray(registrySeed)
) {
  throw new Error('Instruction taxonomy source must contain the legacy catalog and registry seed');
}

export function getLegacyInstructionTaxonomyCatalog() {
  return structuredClone(legacyCatalog);
}

export function getInstructionTaxonomyRegistrySeed() {
  return structuredClone(registrySeed);
}
