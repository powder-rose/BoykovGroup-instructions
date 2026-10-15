import assert from 'node:assert/strict';
import test from 'node:test';

import parsePdf from 'pdf-parse/lib/pdf-parse.js';

import { createInstructionPdfBuffer } from '../src/services/instructionPdfService.js';

const genericSentence =
  'Настоящая инструкция устанавливает требования безопасности при выполнении работ.';
const qualifiedSentence =
  'Настоящая инструкция устанавливает требования безопасности при выполнении работ на высоте.';

function paragraph(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

async function pdfText(instruction) {
  const before = structuredClone(instruction);
  const buffer = await createInstructionPdfBuffer(instruction);
  const pdf = await parsePdf(Uint8Array.from(buffer));
  assert.deepEqual(instruction, before, 'Downloading does not rewrite the stored instruction');
  return pdf.text.replace(/\s+/gu, ' ');
}

test('legacy PDFs omit the exact generic sentence and preserve neighboring and qualified requirements', async () => {
  const text = await pdfText({
    title: 'Проверка старой инструкции',
    intro: genericSentence.replace('выполнении работ', 'выполнении\r\nработ'),
    sections: [
      {
        number: 1,
        heading: 'Общие требования',
        paragraphs: [
          `До начала работы пройти инструктаж. ${genericSentence} Проверить рабочее место.`,
          genericSentence.toLowerCase().replaceAll(' ', '\u00a0'),
          qualifiedSentence,
          'Инструкция устанавливает требования охраны труда при выполнении работ по профессии.',
        ],
      },
    ],
  });

  assert.ok(!text.toLowerCase().includes(genericSentence.toLowerCase()));
  assert.ok(text.includes('1. Общие требования'));
  assert.ok(text.includes('До начала работы пройти инструктаж. Проверить рабочее место.'));
  assert.ok(text.includes(qualifiedSentence));
  assert.ok(
    text.includes(
      'Инструкция устанавливает требования охраны труда при выполнении работ по профессии.',
    ),
  );
});

test('rich PDFs omit wrapped generic text across formatting, lists and table cells without losing content', async () => {
  const text = await pdfText({
    title: 'Проверка инструкции из редактора',
    instructionContent: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Настоящая инструкция ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'устанавливает требования безопасности при выполнении' },
            { type: 'hardBreak' },
            { type: 'text', text: 'работ.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph(genericSentence)] },
            { type: 'listItem', content: [paragraph('Проверить защитное ограждение.')] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [paragraph(`${genericSentence} Проверка инструмента.`)],
                },
                { type: 'tableCell', content: [paragraph('Ответственный работник.')] },
              ],
            },
          ],
        },
        paragraph(qualifiedSentence),
        paragraph('Завершить работу и убрать инструмент.'),
      ],
    },
  });

  assert.ok(!text.includes(genericSentence));
  for (const required of [
    'Проверить защитное ограждение.',
    'Проверка инструмента.',
    'Ответственный работник.',
    qualifiedSentence,
    'Завершить работу и убрать инструмент.',
  ]) {
    assert.ok(text.includes(required), `PDF preserves ${required}`);
  }
});
