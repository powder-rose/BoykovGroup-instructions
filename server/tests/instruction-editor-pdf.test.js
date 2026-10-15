import assert from 'node:assert/strict';
import test from 'node:test';

import parsePdf from 'pdf-parse/lib/pdf-parse.js';

import { createInstructionPdfBuffer } from '../src/services/instructionPdfService.js';

function paragraph(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

test('manual PDF preserves document wording and table cells while excluding surrounding web content', async () => {
  const instruction = {
    title: 'Инструкция для электромонтёра',
    webIntro: 'WEBINTRO_ONLY: рекламное описание страницы.',
    explanationContent: {
      type: 'doc',
      content: [paragraph('EXPLANATION_ONLY: пояснение после кнопки скачивания.')],
    },
    intro: 'LEGACY_INTRO_ONLY: устаревшее документное вступление.',
    sections: [{ heading: 'LEGACY_SECTION_ONLY', paragraphs: ['Устаревшая версия документа.'] }],
    instructionContent: {
      type: 'doc',
      content: [
        paragraph('УТВЕРЖДАЮ. Директор ООО «Ёлка». Подпись: Иванов И.И.'),
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '1. Общие требования безопасности' }],
        },
        paragraph('1.1. Проверить исправность оборудования перед работой.'),
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: ['Оборудование', 'Проверка'].map(text => ({
                type: 'tableHeader',
                attrs: { colspan: 1, rowspan: 1 },
                content: [paragraph(text)],
              })),
            },
            {
              type: 'tableRow',
              content: ['Лестница', 'Осмотр ступеней'].map(text => ({
                type: 'tableCell',
                attrs: { colspan: 1, rowspan: 1 },
                content: [paragraph(text)],
              })),
            },
          ],
        },
        paragraph('Приложение А. Журнал проверки оборудования.'),
      ],
    },
  };
  const buffer = await createInstructionPdfBuffer(instruction);
  const pdf = await parsePdf(Uint8Array.from(buffer));
  const text = pdf.text.replace(/\s+/gu, ' ');

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');

  for (const required of [
    'Инструкция для электромонтёра',
    'УТВЕРЖДАЮ.',
    'Иванов И.И.',
    '1. Общие требования безопасности',
    '1.1. Проверить исправность оборудования перед работой.',
    'Оборудование',
    'Проверка',
    'Лестница',
    'Осмотр ступеней',
    'Приложение А.',
  ]) {
    assert.ok(text.includes(required), `PDF must include ${required}`);
  }

  for (const excluded of [
    'WEBINTRO_ONLY',
    'EXPLANATION_ONLY',
    'LEGACY_INTRO_ONLY',
    'LEGACY_SECTION_ONLY',
  ]) {
    assert.ok(!text.includes(excluded), `PDF must exclude ${excluded}`);
  }
});

test('old instructions without rich content continue to generate the original intro and sections', async () => {
  const buffer = await createInstructionPdfBuffer({
    title: 'Старая инструкция',
    intro: 'Введение в документ.',
    sections: [
      { number: 1, heading: 'Общие требования', paragraphs: ['1.1. Проверить рабочее место.'] },
      { number: 2, heading: 'Перед началом работы', paragraphs: ['2.1. Надеть защитные очки.'] },
    ],
  });
  const pdf = await parsePdf(Uint8Array.from(buffer));
  const text = pdf.text.replace(/\s+/gu, ' ');

  for (const required of [
    'Старая инструкция',
    'Введение в документ.',
    '1. Общие требования',
    '1.1. Проверить рабочее место.',
    '2. Перед началом работы',
    '2.1. Надеть защитные очки.',
  ]) {
    assert.ok(text.includes(required), `Legacy PDF must include ${required}`);
  }
});
