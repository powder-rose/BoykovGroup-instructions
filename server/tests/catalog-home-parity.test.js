import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('catalog uses the same header, portrait and compact scroll layout as home', () => {
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');
  assert.match(catalog, /<Header query=\{queryInput\} onQueryChange=\{setQueryInput\} \/>/u);
  assert.match(catalog, /<HomeCompactHeader[\s\S]*?visible=\{isCompactHeader\}/u);
  assert.match(catalog, /<HomeIntro[\s\S]*?containerRef=\{stickyIntroRef\}/u);
  assert.match(catalog, /useHomeCompactHeader\(\)/u);
  assert.match(catalog, /className=\{homeStyles\.page\}/u);
  assert.match(catalog, /<TaxonomyPageSeo[\s\S]*?Инструкции по охране труда/u);
  assert.match(catalog, /title: 'Инструкции по охране труда \| БОЙКОВГРУПП'/u);
  const hero = read('../../client/src/pages/HomePage/components/HomeHero/HomeHero.jsx');
  assert.match(hero, /<HeroPortrait/u);
  assert.doesNotMatch(catalog, /<h1>/u);
});

test('catalog shares the home instruction cards, generation CTA and pagination', () => {
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');
  const grid = read('../../client/src/components/InstructionCatalog/InstructionsCatalogGrid.jsx');
  const button = read('../../client/src/components/InstructionButton/InstructionButton.jsx');
  assert.match(grid, /<InstructionButton[\s\S]*?showAdminActions=\{false\}/u);
  assert.match(grid, /<InstructionGenerationCard/u);
  assert.match(grid, /<RevealItem/u);
  assert.match(grid, /InstructionList\.module\.css/u);
  assert.match(catalog, /<InstructionListPagination/u);
  assert.match(button, /showAdminActions = true/u);
  assert.match(button, /isAdmin && showAdminActions &&/u);
  assert.match(button, /isAdmin && instruction\?\.source === 'generated'/u);
});

test('catalog search uses the existing API query, sort and page controls', () => {
  const hook = read(
    '../../client/src/components/InstructionCatalog/hooks/useInstructionsCatalog.js',
  );
  assert.match(hook, /queryOnlyChanged \? 350 : 0/u);
  assert.match(hook, /q: query/u);
  assert.match(hook, /page: String\(page\)/u);
  assert.match(hook, /pageSize: String\(PAGE_SIZE\)/u);
  assert.match(hook, /sort,/u);
  assert.match(hook, /new AbortController\(\)/u);
  assert.match(hook, /next\.delete\('page'\)/u);
  assert.match(hook, /useSearchParams\(\)/u);
});

test('catalog prominently links home without new CSS overrides', () => {
  const catalog = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.jsx');
  const css = read('../../client/src/components/InstructionCatalog/InstructionsCatalog.module.css');
  assert.match(catalog, /id="boykovCatalogHomeButton"/u);
  assert.match(catalog, /href="\/"/u);
  assert.match(css, /\.homeButton\s*\{[^}]*background:\s*var\(--color-primary\)/su);
  assert.doesNotMatch(css, /!important/u);
});
