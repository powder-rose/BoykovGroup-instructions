import assert from 'node:assert/strict';
import test from 'node:test';

import parsePdf from 'pdf-parse/lib/pdf-parse.js';

import { formatInstructionDownloadDate } from '../src/services/instructionPdfCompanyLayout.js';
import { createInstructionPdfBuffer } from '../src/services/instructionPdfService.js';

const profile = {
  companyName: 'ООО «Тестовая организация»',
  inn: '7701234567',
  headFullName: 'Петров Пётр Петрович',
  occupationalSafetyPosition: 'Специалист по охране труда',
  occupationalSafetyFullName: 'Иванов Иван Иванович',
};

function paragraph(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

async function readPdf(buffer) {
  const pages = [];
  const parsed = await parsePdf(Uint8Array.from(buffer), {
    pagerender: async page => {
      const content = await page.getTextContent();
      const items = content.items.filter(item => item.str?.trim());
      pages.push(items);
      return items.map(item => item.str).join(' ');
    },
  });
  return { pages, text: parsed.text.replace(/\s+/gu, ' ').trim() };
}

test('company PDF uses the Moscow download date and keeps personal details separate from main content', async () => {
  assert.equal(formatInstructionDownloadDate(new Date('2026-10-15T20:59:59Z')), '15.10.2026');
  assert.equal(formatInstructionDownloadDate(new Date('2026-10-15T21:00:00Z')), '16.10.2026');
  assert.equal(formatInstructionDownloadDate(new Date('2026-12-31T21:00:00Z')), '01.01.2027');
  const instruction = {
    title: 'Инструкция для тестового работника',
    webIntro: 'PRIVATE_WEB_INTRO',
    explanationContent: { type: 'doc', content: [paragraph('PRIVATE_EXPLANATION')] },
    instructionContent: { type: 'doc', content: [paragraph('MAIN_DOCUMENT_END')] },
  };
  const options = {
    companyProfile: { ...profile, headPosition: 'LEGACY_HEAD_POSITION' },
    downloadedAt: new Date('2026-10-15T21:00:00Z'),
  };
  const originalInstruction = structuredClone(instruction);
  const originalProfile = structuredClone(options.companyProfile);
  const { pages, text } = await readPdf(await createInstructionPdfBuffer(instruction, options));
  assert.equal(pages.length, 1);
  for (const value of Object.values(profile)) assert.ok(text.includes(value), value);
  assert.ok(text.includes('16.10.2026'));
  assert.ok(text.includes(`${profile.companyName}, ИНН ${profile.inn}`));
  assert.ok(text.indexOf(profile.companyName) < text.indexOf('УТВЕРЖДАЮ'));
  assert.ok(!text.includes('LEGACY_HEAD_POSITION'));
  assert.ok(text.indexOf(profile.headFullName) > text.indexOf('УТВЕРЖДАЮ'));
  assert.ok(text.indexOf(profile.headFullName) < text.indexOf(instruction.title));
  assert.equal(text.split(profile.headFullName).length - 1, 1);
  assert.equal(text.split(profile.occupationalSafetyFullName).length - 1, 1);
  assert.ok(text.indexOf('УТВЕРЖДАЮ') < text.indexOf(instruction.title));
  assert.ok(
    text.lastIndexOf(profile.occupationalSafetyFullName) > text.indexOf('MAIN_DOCUMENT_END'),
  );
  assert.ok(!text.includes('PRIVATE_WEB_INTRO'));
  assert.ok(!text.includes('PRIVATE_EXPLANATION'));
  assert.deepEqual(instruction, originalInstruction);
  assert.deepEqual(options.companyProfile, originalProfile);
  const approval = pages[0].find(item => item.str === 'УТВЕРЖДАЮ');
  assert.ok(approval.transform[4] >= 297, 'Approval is in the right half of the page');
  const positionLabel = pages[0].find(item => item.str === 'Должность руководителя');
  const headName = pages[0].find(item => item.str === profile.headFullName);
  const approvalDate = pages[0].find(item => item.str === '16.10.2026');
  assert.ok(positionLabel && headName && approvalDate);
  assert.ok(positionLabel.transform[5] < approval.transform[5]);
  assert.ok(headName.transform[5] < positionLabel.transform[5]);
  assert.ok(approvalDate.transform[5] < headName.transform[5]);
  assert.ok(
    Math.abs(positionLabel.transform[4] - approval.transform[4]) < 0.1 &&
      Math.abs(approvalDate.transform[4] - approval.transform[4]) < 0.1,
    'Approval, position label and date share one left edge',
  );
  assert.ok(
    headName.transform[4] > approval.transform[4] + 72,
    'Head name leaves room for a signature on the third line',
  );
  const footerPosition = pages[0]
    .filter(item => item.str === profile.occupationalSafetyPosition)
    .at(-1);
  const footerName = pages[0]
    .filter(item => item.str === profile.occupationalSafetyFullName)
    .at(-1);
  assert.ok(footerPosition && footerName);
  assert.ok(
    Math.abs(footerPosition.transform[5] - footerName.transform[5]) < 0.1,
    'Footer starts on one baseline',
  );
  assert.ok(
    footerName.transform[4] > footerPosition.transform[4] + footerPosition.width,
    'Footer columns do not overlap',
  );
});

test('missing and blank company fields remain an unfilled template and never reuse another download profile', async () => {
  const instruction = { title: 'Пустой шаблон', intro: 'Текст документа.', sections: [] };
  const populated = await readPdf(
    await createInstructionPdfBuffer(instruction, { companyProfile: profile }),
  );
  assert.ok(populated.text.includes(profile.companyName));
  for (const companyProfile of [
    undefined,
    {},
    { companyName: ' ', headFullName: '', occupationalSafetyFullName: '' },
  ]) {
    const { text } = await readPdf(
      await createInstructionPdfBuffer(instruction, {
        companyProfile,
        downloadedAt: new Date('2026-10-15T12:00:00Z'),
      }),
    );
    assert.ok(text.includes('УТВЕРЖДАЮ'));
    assert.ok(text.includes('ИНН'));
    assert.ok(text.includes('15.10.2026'));
    assert.ok(text.includes('Текст документа.'));
    for (const value of [...Object.values(profile), 'undefined', 'null'])
      assert.ok(!text.includes(value), value);
  }
});

test('long company fields and a table across pages preserve content and keep the closing signature together', async () => {
  const repeat = (value, length) =>
    value
      .repeat(Math.ceil(length / value.length))
      .slice(0, length)
      .trim();
  const longProfile = {
    ...profile,
    companyName: repeat('Тестовое производственное объединение ', 300),
    headFullName: repeat('Петров Пётр Петрович ', 200),
    occupationalSafetyPosition: repeat('Ответственный за охрану труда подразделения ', 200),
    occupationalSafetyFullName: repeat('Иванов Иван Иванович ', 200),
  };
  const tableRows = Array.from({ length: 32 }, (_, index) => ({
    type: 'tableRow',
    content: [
      `ROW_${index + 1}`,
      'Проверить исправность защитного ограждения перед началом работ.',
    ].map(value => ({
      type: 'tableCell',
      content: [paragraph(value)],
    })),
  }));
  const instruction = {
    title: 'Проверка многостраничной таблицы',
    instructionContent: {
      type: 'doc',
      content: [
        ...Array.from({ length: 12 }, (_, index) =>
          paragraph(
            `Пункт ${index + 1}. Проверить оборудование и рабочее место перед выполнением операции.`,
          ),
        ),
        { type: 'table', content: tableRows },
        paragraph('MAIN_DOCUMENT_END'),
      ],
    },
  };
  const { pages, text } = await readPdf(
    await createInstructionPdfBuffer(instruction, {
      companyProfile: longProfile,
      downloadedAt: new Date('2026-10-15T12:00:00Z'),
    }),
  );
  assert.ok(pages.length >= 3);
  for (let index = 1; index <= 32; index++) assert.ok(text.includes(`ROW_${index}`));
  for (const value of Object.values(longProfile)) assert.ok(text.includes(value), value);
  const finalItems = pages.at(-1);
  const finalText = finalItems
    .map(item => item.str)
    .join(' ')
    .replace(/\s+/gu, ' ');
  assert.ok(finalText.includes(longProfile.occupationalSafetyPosition));
  assert.ok(finalText.includes(longProfile.occupationalSafetyFullName));
  assert.ok(
    text.lastIndexOf(longProfile.occupationalSafetyFullName) > text.indexOf('MAIN_DOCUMENT_END'),
  );
  for (const items of pages) {
    assert.ok(items.length > 0, 'No blank extra pages');
    for (const item of items) {
      assert.ok(item.transform[4] >= 55, `Text crossed left margin: ${item.str}`);
      assert.ok(item.transform[4] + item.width <= 540, `Text crossed right margin: ${item.str}`);
      assert.ok(item.transform[5] >= 55, `Text crossed bottom margin: ${item.str}`);
    }
  }
});
