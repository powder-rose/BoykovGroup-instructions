import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  nextTagOptionIndex,
  searchCatalogTags,
} from '../../client/src/components/InstructionCatalog/catalogTagSearch.js';

const tags = [
  { id: 'elektrik', label: 'Электрик', count: 9 },
  { id: 'elektromonter', label: 'Электромонтёр', count: 12 },
  { id: 'slesar', label: 'Слесарь', count: 23 },
];

test('tag search ignores case and ё/е differences without reordering matches', () => {
  assert.deepEqual(searchCatalogTags(tags, ''), tags);
  assert.deepEqual(searchCatalogTags(tags, ' ЭЛЕКТРОМОНТЕР '), [tags[1]]);
  assert.deepEqual(searchCatalogTags(tags, 'электр'), [tags[0], tags[1]]);
  assert.deepEqual(searchCatalogTags(tags, 'другой'), []);
});

test('keyboard highlight wraps and works with empty results', () => {
  assert.equal(nextTagOptionIndex(-1, 3, 1), 0);
  assert.equal(nextTagOptionIndex(-1, 3, -1), 2);
  assert.equal(nextTagOptionIndex(2, 3, 1), 0);
  assert.equal(nextTagOptionIndex(0, 3, -1), 2);
  assert.equal(nextTagOptionIndex(-1, 0, 1), -1);
});

test('catalog presents one tag picker instead of separate search and select fields', () => {
  const filters = fs.readFileSync(
    new URL(
      '../../client/src/components/InstructionCatalog/CatalogTaxonomyFilters.jsx',
      import.meta.url,
    ),
    'utf8',
  );
  const picker = fs.readFileSync(
    new URL('../../client/src/components/InstructionCatalog/CatalogTagPicker.jsx', import.meta.url),
    'utf8',
  );
  assert.match(filters, /<CatalogTagPicker\s/u);
  assert.doesNotMatch(filters, /Найти тег/u);
  assert.match(picker, /role="combobox"/u);
  assert.match(picker, /role="listbox"/u);
  assert.match(picker, /aria-activedescendant/u);
  assert.match(picker, /onChange\(option\.id\)/u);
});
