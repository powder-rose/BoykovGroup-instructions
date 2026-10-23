import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import express from 'express';

import { createInstructionPagesRouter } from '../src/routes/instructionPages.js';
import { createSeoRouter } from '../src/routes/seo.js';
import { getInstructionTaxonomyDisplay } from '../src/services/instructionTaxonomyDisplayService.js';
import { getInstructionPublicPath } from '../src/shared/instructionDocument.js';

function sampleInstruction(overrides = {}) {
  return {
    id: 'slesar-elektrik-test',
    slug: 'slesar-elektrik-test',
    title: 'Инструкция по охране труда для слесаря-электрика',
    profession: 'слесаря-электрика',
    webIntro: 'Вступление к инструкции',
    seoTitle: 'Слесарь-электрик: инструкция по охране труда',
    seoDescription: 'Требования охраны труда для слесаря-электрика.',
    primaryCategoryId: 'electrical',
    tagIds: ['slesar', 'elektrik'],
    taxonomyMeta: { categorySource: 'auto', tagsSource: 'auto', needsReview: false },
    instructionContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст инструкции.' }] }],
    },
    ...overrides,
  };
}

test('public taxonomy uses canonical dictionary, ignores invalid IDs and never mutates the instruction', () => {
  const instruction = Object.freeze(
    sampleInstruction({ tagIds: Object.freeze(['slesar', 'elektrik', 'elektrik', 'unknown']) }),
  );
  assert.deepEqual(getInstructionTaxonomyDisplay(instruction), {
    category: { id: 'electrical', label: 'Электротехника и энергетика' },
    tags: [
      { id: 'slesar', label: 'Слесарь' },
      { id: 'elektrik', label: 'Электрик' },
    ],
  });
  assert.deepEqual(instruction.tagIds, ['slesar', 'elektrik', 'elektrik', 'unknown']);
  assert.equal(getInstructionTaxonomyDisplay(null), null);
  assert.equal(getInstructionTaxonomyDisplay({}), null);
  assert.equal(
    getInstructionTaxonomyDisplay({ primaryCategoryId: '<script>', tagIds: ['<img>'] }),
    null,
  );
  assert.deepEqual(getInstructionTaxonomyDisplay({ tagIds: ['slesar'] }), {
    category: null,
    tags: [{ id: 'slesar', label: 'Слесарь' }],
  });
});

async function fixture(t, instruction) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-public-tags-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Before</title></head><body><div id="root"></div></body></html>',
  );
  const repository = {
    getAll: () => [instruction],
    getBySlug: id => (id === instruction.id || id === instruction.slug ? instruction : null),
  };
  const app = express();
  app.use('/api/instructions', createInstructionPagesRouter({ repository }));
  app.use(createSeoRouter({ repository, indexPath, relatedInstructions: () => [] }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('public API and SEO HTML show the same labels after H1; tags are not links', async t => {
  const instruction = sampleInstruction();
  const base = await fixture(t, instruction);
  const apiResponse = await fetch(`${base}/api/instructions/page/${instruction.slug}`);
  assert.equal(apiResponse.status, 200);
  const api = await apiResponse.json();
  assert.deepEqual(api.taxonomyDisplay, getInstructionTaxonomyDisplay(instruction));
  assert.equal(api.primaryCategoryId, instruction.primaryCategoryId);
  assert.deepEqual(api.tagIds, instruction.tagIds);

  const response = await fetch(`${base}${getInstructionPublicPath(instruction)}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const header = html.match(/<header data-copy-protected="true">([\s\S]*?)<\/header>/u)?.[1];
  assert.ok(header, 'SEO document header exists');
  assert.match(header, /class="InstructionTaxonomy_root"/u);
  assert.match(
    header,
    /class="InstructionTaxonomy_category" href="\/instrukcii-po-ohrane-truda\?category=electrical">Раздел: Электротехника и энергетика<\/a>/u,
  );
  assert.match(
    header,
    /class="InstructionTaxonomy_tag" href="\/instrukcii-po-ohrane-truda\?tag=slesar">Слесарь<\/a>/u,
  );
  assert.match(
    header,
    /class="InstructionTaxonomy_tag" href="\/instrukcii-po-ohrane-truda\?tag=elektrik">Электрик<\/a>/u,
  );
  assert.ok(header.indexOf('<h1>') < header.indexOf('InstructionTaxonomy_root'));
  assert.ok(header.indexOf('InstructionTaxonomy_root') < header.indexOf('Вступление к инструкции'));
  assert.equal((html.match(/<h1>/gu) || []).length, 1);
  assert.equal(html.includes('taxonomyMeta'), false);
  assert.match(html, /\.InstructionTaxonomy_root\s*\{/u);
  assert.match(html, /name="description"/u);
  assert.match(html, /rel="canonical"/u);
});

test('legacy unclassified instruction keeps its public appearance and no extra taxonomy markup', async t => {
  const instruction = sampleInstruction({
    primaryCategoryId: undefined,
    tagIds: undefined,
    taxonomyMeta: undefined,
  });
  const base = await fixture(t, instruction);
  const apiResponse = await fetch(`${base}/api/instructions/page/${instruction.slug}`);
  const api = await apiResponse.json();
  assert.equal(Object.hasOwn(api, 'taxonomyDisplay'), false);
  const response = await fetch(`${base}${getInstructionPublicPath(instruction)}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const header = html.match(/<header data-copy-protected="true">([\s\S]*?)<\/header>/u)?.[1];
  assert.ok(header);
  assert.equal(header.includes('InstructionTaxonomy_root'), false);
  assert.ok(header.includes('Вступление к инструкции'));
});

test('React instruction page uses the same API taxonomy display projection', () => {
  const component = fs.readFileSync(
    new URL('../../client/src/components/InstructionPage/InstructionPage.jsx', import.meta.url),
    'utf8',
  );
  const view = fs.readFileSync(
    new URL('../../client/src/components/InstructionPage/InstructionTaxonomy.jsx', import.meta.url),
    'utf8',
  );
  assert.match(component, /<InstructionTaxonomy taxonomy=\{instruction\.taxonomyDisplay\}/u);
  assert.match(view, /className=\{styles\.category\}/u);
  assert.match(view, /className=\{styles\.tag\}/u);
  assert.match(view, /<Link/u);
  assert.match(view, /\?category=\$\{encodeURIComponent\(category\.id\)\}/u);
  assert.match(view, /\?tag=\$\{encodeURIComponent\(tag\.id\)\}/u);
});
