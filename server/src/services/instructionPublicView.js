const EDITORIAL_FIELDS = new Set([
  'editorialMeta',
  'publishedEditorialMeta',
  'seoReadySource',
  'seoAuthor',
  'contentAuthor',
]);

// Instruction records are JSON data. Clone before stripping internal fields so
// cached records, paid-order copies and any embedded versions remain untouched.
export function toPublicInstruction(instruction) {
  if (Array.isArray(instruction)) return instruction.map(toPublicInstruction);
  if (!instruction || typeof instruction !== 'object') return instruction;

  return Object.fromEntries(
    Object.entries(instruction)
      .filter(([field]) => !EDITORIAL_FIELDS.has(field))
      .map(([field, value]) => [field, toPublicInstruction(value)]),
  );
}
