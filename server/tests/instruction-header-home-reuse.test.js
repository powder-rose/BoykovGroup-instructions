import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('instruction header reuses the catalog home button', () => {
  const header = read(
    '../../client/src/components/InstructionStickyHeader/InstructionStickyHeader.jsx',
  );
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');
  const catalogCss = read(
    '../../client/src/components/InstructionCatalog/InstructionsCatalog.module.css',
  );
  const headerCss = read(
    '../../client/src/components/InstructionStickyHeader/InstructionStickyHeader.module.css',
  );

  assert.match(
    header,
    /import catalogStyles from '\.\.\/InstructionCatalog\/InstructionsCatalog\.module\.css'/u,
  );
  assert.match(header, /<Link to="\/" className=\{catalogStyles\.homeButton\}>/u);
  assert.match(catalog, /className=\{styles\.homeButton\}/u);
  assert.match(catalogCss, /\.homeButton\s*\{[^}]*background:\s*var\(--color-primary\)/su);
  assert.doesNotMatch(headerCss, /\.homeButton\s*\{/u);
});

test('home button is displayed before the portrait', () => {
  const header = read(
    '../../client/src/components/InstructionStickyHeader/InstructionStickyHeader.jsx',
  );

  assert.match(
    header,
    /className=\{styles\.profileActions\}>[\s\S]*?className=\{catalogStyles\.homeButton\}[\s\S]*?На главную[\s\S]*?<HeroPortrait compact \/>/u,
  );
  assert.match(header, /<AuthControl compact \/>/u);
});
