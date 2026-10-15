import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

import { createSeoRouter } from '../src/routes/seo.js';
import { getInstructionPublicPath, getInstructionSeo } from '../src/shared/instructionDocument.js';

const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const heading = (text, level = 2) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const richDocument = content => ({ type: 'doc', content });

function sampleInstruction(overrides = {}) {
  return {
    id: 'stable-id',
    slug: 'elektromonter',
    slugAliases: ['old-elektromonter'],
    title: 'Инструкция для электромонтера',
    seoTitle: 'Ручной SEO title',
    seoDescription: 'Ручное SEO описание',
    webIntro: 'Вводный текст страницы <безопасно>',
    instructionContent: richDocument([
      paragraph('УТВЕРЖДАЮ. Начало полного документа'),
      heading('Общие требования'),
      paragraph('Требования <script>alert(1)</script>'),
      { type: 'heading', attrs: { level: 2 } },
      heading('Особые требования', 3),
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [paragraph('Параметр')] },
              { type: 'tableCell', content: [paragraph('Значение')] },
            ],
          },
        ],
      },
      paragraph('Замены $& $$ остаются текстом'),
      paragraph('Приложение. Конец полного документа'),
    ]),
    explanationContent: richDocument([
      heading('Разъяснения после инструкции'),
      paragraph('Дополнительный текст страницы'),
    ]),
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: '2035-06-12T13:14:15.000Z',
      contentUpdatedAt: '2035-06-11T13:14:15.000Z',
      seoReadySource: 'EDITORIAL_METADATA_ONLY',
      seoAuthor: 'SEO_EDITOR_PRIVATE_NAME',
      contentAuthor: 'TEXT_EDITOR_PRIVATE_NAME',
    },
    ...overrides,
  };
}

async function startFixture(t, items, related = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykov-instruction-seo-'));
  const indexPath = path.join(directory, 'index.html');
  fs.writeFileSync(
    indexPath,
    '<!doctype html><html lang="ru"><head><title>Old title</title><meta name="description" content="old"><meta name="robots" content="old"><link rel="canonical" href="old"><meta property="og:title" content="old"><meta name="twitter:title" content="old"><script type="application/ld+json">{"old":true}</script></head><body><div id="root"></div></body></html>',
  );
  const repository = {
    getAll: () => items,
    getBySlug: value =>
      items.find(
        item => item.id === value || item.slug === value || item.slugAliases?.includes(value),
      ) || null,
  };
  const app = express();
  app.use(createSeoRouter({ repository, indexPath, relatedInstructions: () => related }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    siteUrl: String(process.env.SITE_URL || base)
      .trim()
      .replace(/\/+$/u, ''),
  };
}

test('instruction HTML keeps PDF above the protected rich document and preserves complete SEO text', async t => {
  const instruction = sampleInstruction();
  const related = sampleInstruction({ id: 'related-id', slug: 'slesar', title: 'Для слесаря' });
  const { base, siteUrl } = await startFixture(t, [instruction], [related]);
  const response = await fetch(`${base}${getInstructionPublicPath(instruction)}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();

  const positions = [
    '<h1>Инструкция для электромонтера</h1>',
    'Вводный текст страницы &lt;безопасно&gt;',
    'data-instruction-pdf-download="stable-id"',
    'aria-label="Содержание инструкции"',
    'УТВЕРЖДАЮ. Начало полного документа',
    'Приложение. Конец полного документа',
    'Разъяснения после инструкции',
    'Дополнительный текст страницы',
    'Похожие инструкции',
  ].map(text => {
    const position = html.indexOf(text);
    assert.notEqual(position, -1, `Missing visible content: ${text}`);
    return position;
  });
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
  );
  assert.match(
    html,
    /<header data-copy-protected="true">\s*<h1>Инструкция для электромонтера<\/h1>\s*<p class="instruction-web-intro">Вводный текст страницы &lt;безопасно&gt;<\/p>\s*<\/header>/u,
  );
  assert.match(
    html,
    /<div class="instruction-reading" data-copy-protected="true">\s*<nav class="instruction-outline"[\s\S]*?<section class="instruction-document"[\s\S]*?Приложение\. Конец полного документа[\s\S]*?<\/section>\s*<\/div>/u,
  );
  assert.ok(html.includes('<div class="instruction-explanation" data-copy-protected="true">'));
  assert.match(html, /<style data-copy-protection>[\s\S]*?user-select: none;[\s\S]*?<\/style>/u);
  assert.equal((html.match(/data-instruction-pdf-download="stable-id"/gu) || []).length, 1);
  assert.ok(html.includes('5 скачиваний на аккаунт за всё время'));
  assert.ok(html.includes('<table><tbody><tr>'));
  assert.ok(html.includes('Замены $&amp; $$ остаются текстом'));
  assert.equal((html.match(/id="root"/gu) || []).length, 1);
  assert.ok(html.includes('Требования &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('href="#instruction-section-1"'));
  assert.ok(html.includes('id="instruction-section-1"'));
  assert.ok(html.includes('href="#instruction-section-3"'));
  assert.ok(html.includes('<h3 id="instruction-section-3">Особые требования</h3>'));
  assert.equal(html.includes('href="#instruction-section-2"'), false);
  assert.ok(html.includes('id="explanation-section-1"'));
  assert.ok(html.includes(`href="${getInstructionPublicPath(related)}"`));
  assert.equal((html.match(/<h1>/gu) || []).length, 1);
  assert.equal((html.match(/<title>/gu) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/gu) || []).length, 1);
  assert.equal((html.match(/application\/ld\+json/gu) || []).length, 1);
  assert.ok(html.includes('<title>Ручной SEO title</title>'));
  assert.match(html, /property="og:title"\s+content="Ручной SEO title"/u);
  assert.match(html, /name="description"\s+content="Ручное SEO описание"/u);
  assert.ok(html.includes(`href="${siteUrl}${getInstructionPublicPath(instruction)}"`));
  assert.ok(html.includes('<script type="application/ld+json" data-instruction-seo>'));
  assert.ok(html.includes('"@type":"Article"'));
  assert.ok(html.includes('"@type":"BreadcrumbList"'));
  assert.equal(html.includes('"old":true'), false);
  assert.equal(html.includes('editorialMeta'), false);
  assert.equal(html.includes('EDITORIAL_METADATA_ONLY'), false);
  assert.equal(html.includes('SEO_EDITOR_PRIVATE_NAME'), false);
  assert.equal(html.includes('TEXT_EDITOR_PRIVATE_NAME'), false);
  assert.equal(html.includes('2035-06-12'), false);
});

test('fallback navigation exposes the Passport Safety destination as a working link', async t => {
  const { base } = await startFixture(t, []);
  const response = await fetch(`${base}/instrukciya-po-ohrane-truda/missing`);
  assert.equal(response.status, 404);
  const html = await response.text();
  const navigation = html.match(/<nav class="CategoryNav_nav"[\s\S]*?<\/nav>/u)?.[0];

  assert.ok(navigation);
  assert.match(
    navigation,
    /<a\s+href="https:\/\/pasport-bezopasnosty\.ru\/"\s+class="CategoryNav_link"\s*>Паспорт Безопасности<\/a>/u,
  );
  assert.equal(navigation.includes('Антитеррористическая безопасность'), false);
  assert.ok(
    html.includes('<link rel="stylesheet" href="/assets/instruction-copy-protection.css">'),
  );
  assert.ok(html.includes('<script defer src="/assets/instruction-copy-protection.js"></script>'));
});

test('legacy instruction still renders its intro and every paragraph with the shared SEO fallback', async t => {
  const instruction = sampleInstruction({
    slug: undefined,
    seoTitle: '',
    seoDescription: '',
    webIntro: '',
    instructionContent: undefined,
    explanationContent: undefined,
    intro: 'Старое введение документа',
    sections: [
      {
        number: 1,
        heading: 'Общие требования',
        paragraphs: ['Первый пункт', { text: 'Второй пункт' }],
      },
      { number: 2, title: 'Порядок действий', items: [{ content: 'Последний пункт' }] },
    ],
  });
  const { base } = await startFixture(t, [instruction]);
  const response = await fetch(`${base}${getInstructionPublicPath(instruction)}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  const seo = getInstructionSeo(instruction);
  assert.ok(html.includes(`<title>${seo.title}</title>`));
  assert.ok(html.includes(`content="${seo.description}"`));
  assert.equal((html.match(/Старое введение документа/gu) || []).length, 1);
  for (const content of ['Первый пункт', 'Второй пункт', 'Последний пункт']) {
    assert.ok(html.includes(content));
  }
  assert.ok(html.includes('<h2 id="instruction-section-1">1. Общие требования</h2>'));
  assert.ok(html.includes('<h2 id="instruction-section-2">2. Порядок действий</h2>'));
  assert.equal(html.includes('class="instruction-web-intro"'), false);
});

test('stable IDs, historical slugs and trailing slashes redirect to one canonical URL', async t => {
  const instruction = sampleInstruction();
  const migrated = sampleInstruction({
    id: 'instruktsiya-po-ohrane-truda-dlya-sistemnogo-administratora-CfhwZb',
    slug: 'sistemnyi-administrator-new',
    slugAliases: [],
  });
  const { base, siteUrl } = await startFixture(t, [instruction, migrated]);
  for (const alias of [instruction.id, ...instruction.slugAliases, `${instruction.slug}/`]) {
    const response = await fetch(`${base}/instrukciya-po-ohrane-truda/${alias}?source=search`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get('location'),
      `${siteUrl}${getInstructionPublicPath(instruction)}?source=search`,
    );
  }
  const oldRedirect = await fetch(`${base}/instrukciya-po-ohrane-truda/sistemnyy-administrator`, {
    redirect: 'manual',
  });
  assert.equal(oldRedirect.status, 301);
  assert.equal(
    oldRedirect.headers.get('location'),
    `${siteUrl}${getInstructionPublicPath(migrated)}`,
  );
});

test('catalog and sitemap use published canonical slugs; drafts and removed article routes are absent', async t => {
  const published = sampleInstruction();
  const draft = sampleInstruction({ id: 'draft-id', slug: 'draft-only', status: 'draft' });
  const seoDraft = sampleInstruction({ id: 'seo-draft', slug: 'seo-draft', seoStatus: 'draft' });
  const noindex = sampleInstruction({
    id: 'noindex-id',
    slug: 'noindex-only',
    seoStatus: 'noindex',
  });
  const { base } = await startFixture(t, [published, draft, seoDraft, noindex]);

  for (const route of ['/instrukcii-po-ohrane-truda', '/sitemap.xml']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes(getInstructionPublicPath(published)));
    for (const hidden of [draft, seoDraft, noindex]) {
      assert.equal(body.includes(getInstructionPublicPath(hidden)), false);
    }
    assert.equal(body.includes('/stati'), false);
    assert.equal(body.includes(`/instrukciya-po-ohrane-truda/${published.id}`), false);
    assert.equal(body.includes(`/instrukciya-po-ohrane-truda/${published.slugAliases[0]}`), false);
    assert.equal(body.includes('EDITORIAL_METADATA_ONLY'), false);
    assert.equal(body.includes('SEO_EDITOR_PRIVATE_NAME'), false);
    assert.equal(body.includes('TEXT_EDITOR_PRIVATE_NAME'), false);
    assert.equal(body.includes('2035-06-12'), false);
    if (route === '/sitemap.xml') assert.ok(body.includes('<lastmod>2026-10-15</lastmod>'));
  }

  for (const slug of ['missing', draft.slug, seoDraft.slug]) {
    const response = await fetch(`${base}/instrukciya-po-ohrane-truda/${slug}`);
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.ok(body.includes('noindex, follow'));
    assert.equal(body.includes('УТВЕРЖДАЮ. Начало полного документа'), false);
  }
  const noindexResponse = await fetch(`${base}${getInstructionPublicPath(noindex)}`);
  assert.equal(noindexResponse.status, 200);
  assert.match(await noindexResponse.text(), /name="robots"\s+content="noindex, follow"/u);
});

test('a historical redirect cannot loop when its target adopts the old address', async t => {
  const instruction = sampleInstruction({
    id: 'instruktsiya-po-ohrane-truda-dlya-sistemnogo-administratora-CfhwZb',
    slug: 'sistemnyy-administrator',
  });
  const { base } = await startFixture(t, [instruction]);
  const response = await fetch(`${base}${getInstructionPublicPath(instruction)}`, {
    redirect: 'manual',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});
