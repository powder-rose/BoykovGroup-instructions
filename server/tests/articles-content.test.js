import assert from 'node:assert/strict';
import test from 'node:test';

import parsePdf from 'pdf-parse/lib/pdf-parse.js';

import {
  createArticleInstructionPdf,
  findInstructionBlock,
  normalizeArticleContent,
  renderArticleContentToHtml,
} from '../src/services/articleContent.js';

const instructionText = [
  'УТВЕРЖДАЮ: директор ООО «Ёлка»',
  '  Инструкция № 17 — для электромонтёра',
  '',
  '1. Перед работой проверить инструмент.',
  '2. Не применять неисправный инструмент.',
  '',
  'Приложение А. Подпись: Иванов И.И.',
].join('\n');

function instructionNode(overrides = {}) {
  return {
    type: 'instruction',
    attrs: {
      id: 'instruction_test_01',
      title: 'Инструкция электромонтёра',
      text: instructionText,
      ...overrides,
    },
  };
}

function paragraph(text, marks) {
  return { type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] };
}

test('article content preserves full instruction wording and article text on both sides', () => {
  const content = {
    type: 'doc',
    content: [paragraph('Перед инструкцией'), instructionNode(), paragraph('После инструкции')],
  };

  const normalized = normalizeArticleContent(content);

  assert.deepEqual(
    normalized.content.map(node => node.type),
    ['paragraph', 'instruction', 'paragraph'],
  );
  assert.equal(findInstructionBlock(normalized, 'instruction_test_01').attrs.text, instructionText);
  assert.equal(findInstructionBlock(normalized, 'missing_block'), null);

  const html = renderArticleContentToHtml(normalized);

  assert.ok(html.indexOf('Перед инструкцией') < html.indexOf('УТВЕРЖДАЮ'));
  assert.ok(html.indexOf('Приложение А.') < html.indexOf('После инструкции'));
  assert.ok(html.includes('Подпись: Иванов И.И.'));
});

test('article text and instruction attributes cannot create HTML markup', () => {
  const content = normalizeArticleContent({
    type: 'doc',
    content: [
      paragraph('<script>alert("article")</script>'),
      instructionNode({
        title: '<img src=x onerror=alert(1)>',
        text: '<svg onload=alert(2)> & "текст"',
      }),
    ],
  });

  const html = renderArticleContentToHtml(content);

  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<svg'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;svg'));
  assert.ok(html.includes('&amp;'));
});

test('article validation rejects executable links, arbitrary nodes and duplicate instruction IDs', () => {
  const invalidDocuments = [
    { type: 'doc', content: [{ type: 'script', content: [] }] },
    { type: 'doc', content: [instructionNode(), instructionNode()] },
    { type: 'doc', content: [instructionNode({ id: '../../private-file' })] },
    { type: 'doc', content: [instructionNode({ text: '' })] },
    ...[
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ].map(href => ({
      type: 'doc',
      content: [paragraph('Нажмите', [{ type: 'link', attrs: { href } }])],
    })),
  ];

  for (const document of invalidDocuments) {
    assert.throws(() => normalizeArticleContent(document), { status: 400 });
  }
});

test('article normalization removes untrusted attributes from valid nodes and marks', () => {
  const content = normalizeArticleContent({
    type: 'doc',
    attrs: { onload: 'alert(1)' },
    content: [
      {
        ...paragraph('Ссылка', [
          {
            type: 'link',
            attrs: { href: 'https://example.org/help?a=1&b=2', onclick: 'alert(2)' },
          },
        ]),
        attrs: { style: 'background:url(javascript:alert(3))', onmouseover: 'alert(4)' },
      },
    ],
  });

  const serialized = JSON.stringify(content);
  const html = renderArticleContentToHtml(content);

  assert.ok(!serialized.includes('alert('));
  assert.ok(!html.includes('onclick='));
  assert.ok(!html.includes('onmouseover='));
  assert.ok(html.includes('https://example.org/help?a=1&amp;b=2'));
});

test('Tiptap nested instruction blocks and default attributes survive storage and HTML rendering', () => {
  const blockIds = [
    'instruction_quote',
    'instruction_list',
    'instruction_header',
    'instruction_cell',
  ];
  const content = normalizeArticleContent({
    type: 'doc',
    content: [
      { type: 'blockquote', content: [instructionNode({ id: blockIds[0] })] },
      {
        type: 'orderedList',
        attrs: { start: 1, type: null },
        content: [
          {
            type: 'listItem',
            content: [
              paragraph('Источник', [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.org/instructions',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: null,
                  },
                },
              ]),
              instructionNode({ id: blockIds[1] }),
            ],
          },
        ],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 1, rowspan: 1, colwidth: null },
                content: [instructionNode({ id: blockIds[2] })],
              },
              {
                type: 'tableCell',
                attrs: { colspan: 1, rowspan: 1, colwidth: null },
                content: [instructionNode({ id: blockIds[3] })],
              },
            ],
          },
        ],
      },
    ],
  });
  const reloaded = normalizeArticleContent(JSON.parse(JSON.stringify(content)));

  assert.deepEqual(reloaded, content);

  for (const id of blockIds) {
    assert.equal(findInstructionBlock(reloaded, id).attrs.text, instructionText);
  }

  const list = reloaded.content[1];
  const link = list.content[0].content[0].content[0].marks[0];

  assert.deepEqual(list.attrs, { start: 1 });
  assert.deepEqual(link.attrs, {
    href: 'https://example.org/instructions',
    target: '_blank',
  });
  assert.deepEqual(reloaded.content[2].content[0].content[0].attrs, { colspan: 1, rowspan: 1 });

  const html = renderArticleContentToHtml(reloaded);

  assert.ok(html.includes('<blockquote><section'));
  assert.ok(html.includes('<ol start="1"><li>'));
  assert.ok(html.includes('<th colspan="1" rowspan="1"><section'));
  assert.ok(html.includes('<td colspan="1" rowspan="1"><section'));
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));

  for (const id of blockIds) {
    assert.ok(html.includes(`data-instruction-id="${id}"`));
    assert.ok(html.includes(`data-article-instruction-download="${id}"`));
  }
});

test('Tiptap hard breaks with active formatting remain valid and render a line break', () => {
  const content = normalizeArticleContent({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Первая строка', marks: [{ type: 'bold' }] },
          { type: 'hardBreak', marks: [{ type: 'bold', attrs: { onclick: 'alert(1)' } }] },
          { type: 'text', text: 'Вторая строка' },
        ],
      },
    ],
  });

  assert.deepEqual(content.content[0].content[1], {
    type: 'hardBreak',
    marks: [{ type: 'bold' }],
  });
  assert.equal(
    renderArticleContentToHtml(content),
    '<p><strong>Первая строка</strong><br>Вторая строка</p>',
  );
});

test('article validation rejects oversized and excessively nested editor documents', () => {
  assert.throws(
    () =>
      normalizeArticleContent({
        type: 'doc',
        content: [instructionNode({ text: 'а'.repeat(2_000_001) })],
      }),
    { status: 400 },
  );

  let nested = paragraph('Nested');

  for (let depth = 0; depth < 150; depth += 1) {
    nested = { type: 'blockquote', content: [nested] };
  }

  assert.throws(() => normalizeArticleContent({ type: 'doc', content: [nested] }), {
    status: 400,
  });
});

test('generated article PDF retains pasted preamble, numbered requirements and appendix', async () => {
  const pdf = await createArticleInstructionPdf(instructionNode());

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');

  const parsed = await parsePdf(pdf);
  const extracted = parsed.text.normalize('NFKC');

  for (const line of instructionText.split('\n').filter(line => line.trim())) {
    assert.ok(
      extracted.includes(line.trim().normalize('NFKC')),
      `Missing pasted PDF wording: ${line}`,
    );
  }

  assert.ok(parsed.text.indexOf('УТВЕРЖДАЮ') < parsed.text.indexOf('1. Перед работой'));
  assert.ok(parsed.text.indexOf('2. Не применять') < parsed.text.indexOf('Приложение А.'));
});
