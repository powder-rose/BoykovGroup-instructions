import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('catalog shows one centered generation CTA when no instructions are returned', () => {
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');

  assert.match(catalog, /items\.length > 0\s*\?\s*\(/u);
  assert.match(catalog, /<InstructionResultsToolbar[\s\S]*?<InstructionsCatalogGrid/u);
  assert.match(catalog, /\)\s*:\s*\(\s*<section className=\{styles\.empty\}/u);
  assert.match(catalog, /Не нашли нужную инструкцию\?/u);
  assert.match(catalog, /Создадим индивидуальную инструкцию по охране труда за 2 минуты/u);
  assert.match(
    catalog,
    /to="\/srochnaya-generaciya-instrukcii"[\s\S]{0,120}?className=\{styles\.emptyAction\}/u,
  );
  assert.match(catalog, /Сгенерировать инструкцию/u);
  assert.doesNotMatch(catalog, /Инструкции пока не опубликованы/u);
  assert.doesNotMatch(catalog, /items\.length === 0 &&/u);
});

test('empty results hide sorting and count but preserve regular catalog pagination', () => {
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');

  assert.match(
    catalog,
    /!loading\s*&&\s*!error\s*&&\s*\(items\.length > 0\s*\?\s*\(\s*<>\s*<InstructionResultsToolbar/u,
  );
  assert.match(catalog, /<InstructionListPagination/u);
  assert.match(catalog, /<InstructionsCatalogGrid items=\{items\} isAdmin=\{isAdmin\}/u);
  assert.match(catalog, /\{query && \(\s*<p className=\{styles\.emptyQuery\}/u);
});

test('empty state is centered and responsive without CSS overrides', () => {
  const css = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.module.css');

  assert.match(
    css,
    /\.empty\s*\{[^}]*width:\s*min\(100%,\s*580px\);[^}]*margin:\s*42px auto 76px/su,
  );
  assert.match(css, /\.emptyAction\s*\{[^}]*background:\s*#2f6fd6/su);
  assert.match(
    css,
    /@media \(max-width:\s*650px\)\s*\{[\s\S]*?\.emptyAction\s*\{\s*width:\s*100%/u,
  );
  assert.doesNotMatch(css, /!important/u);
});
