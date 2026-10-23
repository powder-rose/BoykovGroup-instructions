import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('editor classifies drafts and publications at the service boundary', () => {
  const editor = read('../src/services/instructionEditorService.js');
  const repository = read('../src/services/instructionsRepository.js');
  assert.match(editor, /const instruction\s*=\s*applyInstructionTaxonomyEditorPatch\s*\(/u);
  assert.match(editor, /input\.taxonomyPatch/u);
  assert.match(editor, /writeDraft\(\s*instruction\s*[,)]/u);
  assert.match(editor, /repository\.save\(\s*instruction\s*[,)]/u);
  assert.doesNotMatch(repository, /prepareInstructionTaxonomy|saveInstructionWithTaxonomy/u);
});

test('both import queues classify new and revised records, not duplicate responses', () => {
  for (const path of [
    '../src/services/importWorker.js',
    '../src/services/bulkImportWorkerService.js',
  ]) {
    const code = read(path);
    assert.match(
      code,
      /saveInstructionWithTaxonomy\(instructionsRepository, result\.instruction\)/u,
    );
    assert.match(code, /saveInstructionWithTaxonomy\(instructionsRepository, versioned\)/u);
    assert.match(code, /case 'duplicate':/u);
  }
});

test('scheduled, direct and approved paid generation use the same save boundary', () => {
  for (const path of [
    '../src/services/scheduledGenerationService.js',
    '../src/services/retryImportService.js',
    '../src/routes/instructions.js',
    '../src/routes/publicGeneration.js',
  ]) {
    const code = read(path);
    assert.match(code, /saveInstructionWithTaxonomy\(instructionsRepository,/u);
  }
  const paid = read('../src/routes/publicGeneration.js');
  assert.match(paid, /'\/admin\/orders\/:id\/approve'/u);
});
