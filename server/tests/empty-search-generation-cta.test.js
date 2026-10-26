import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('empty home search explains the missing result', () => {
  const component = read('../../client/src/components/EmptyState/EmptyState.jsx');

  assert.match(component, /Ничего не найдено/u);
  assert.match(component, /По запросу «\{query\}» инструкций не найдено/u);
  assert.match(component, /всего за 2 минуты/u);
  assert.doesNotMatch(component, /<p className=\{styles\.hint\}>\.<\/p>/u);
});

test('guest receives the existing catalog generation CTA', () => {
  const component = read('../../client/src/components/EmptyState/EmptyState.jsx');

  const catalogCss = read(
    '../../client/src/components/InstructionCatalog/InstructionsCatalog.module.css',
  );

  assert.match(component, /import \{ Link \} from 'react-router-dom'/u);

  assert.match(component, /to="\/srochnaya-generaciya-instrukcii"/u);

  assert.match(component, /className=\{catalogStyles\.emptyAction\}/u);

  assert.match(component, /Создать инструкцию/u);

  assert.match(catalogCss, /\.emptyAction\s*\{[^}]*background:\s*#2f6fd6/su);
});

test('existing admin generation remains available', () => {
  const component = read('../../client/src/components/EmptyState/EmptyState.jsx');

  assert.match(component, /\{isAdmin \? \(/u);
  assert.match(component, /onClick=\{onGenerate\}/u);
  assert.match(component, /disabled=\{isGenerating\}/u);
  assert.match(component, /\{error &&/u);
});

test('empty state preserves its dashed card and appears for a completed empty search or catalog', () => {
  const css = read('../../client/src/components/EmptyState/EmptyState.module.css');

  const results = read(
    '../../client/src/pages/HomePage/components/InstructionResults/InstructionResults.jsx',
  );

  const hook = read('../../client/src/pages/HomePage/hooks/useHomeInstructions.js');

  assert.match(css, /border: 2px dashed var\(--color-text\)/u);
  assert.match(css, /\.iconWrap/u);
  assert.match(css, /@media \(max-width: 600px\)/u);

  assert.match(results, /\{showEmptyState && \(/u);

  assert.match(
    hook,
    /!isSearching\s*&&\s*!searchError\s*&&\s*Boolean\(debouncedQuery\.trim\(\) \|\| catalogId \|\| category \|\| tag\)\s*&&\s*items\.length === 0/u,
  );
  const component = read('../../client/src/components/EmptyState/EmptyState.jsx');
  assert.match(component, /В выбранном каталоге пока нет инструкций/u);
  assert.match(component, /query\.trim\(\) &&/u);
});
