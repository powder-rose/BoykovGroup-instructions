import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';
import { richTextToPlainText } from '../shared/instructionDocument.js';
import { instructionBodyText } from './instructionDownloadText.js';
import {
  renderInstructionCompanyHeader,
  renderInstructionCompanySignature,
} from './instructionPdfCompanyLayout.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const LOCAL_REGULAR_FONT = path.resolve(__dirname, '../../assets/fonts/DejaVuSans.ttf');

const LOCAL_BOLD_FONT = path.resolve(__dirname, '../../assets/fonts/DejaVuSans-Bold.ttf');

const REGULAR_FONT_CANDIDATES = [
  /*
   * Основной вариант для production.
   *
   * Шрифт лежит внутри приложения,
   * поэтому доступен Passenger.
   */
  LOCAL_REGULAR_FONT,

  /*
   * Дополнительные варианты.
   */
  process.env.PDF_FONT_PATH,

  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',

  '/usr/share/fonts/dejavu/DejaVuSans.ttf',

  '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',

  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
].filter(Boolean);

const BOLD_FONT_CANDIDATES = [
  LOCAL_BOLD_FONT,

  process.env.PDF_FONT_BOLD_PATH,

  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',

  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',

  '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',

  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
].filter(Boolean);

function findFont(candidates) {
  return candidates.find(file => fs.existsSync(file)) ?? null;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function sectionHeading(section) {
  const heading = instructionBodyText(section?.heading);

  const number = section?.number;

  if (!heading) {
    return '';
  }

  if (number === undefined || number === null || number === '') {
    return heading;
  }

  const normalizedNumber = String(number).trim();

  if (heading.startsWith(`${normalizedNumber}.`) || heading.startsWith(`${normalizedNumber} `)) {
    return heading;
  }

  return `${normalizedNumber}. ${heading}`;
}

function renderRichInstruction(document, content, { regularFont, boldFont }) {
  function render(node, prefix = '') {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const originalText = richTextToPlainText(node);
      const text = instructionBodyText(originalText);

      if (!text) {
        if (!originalText.trim()) document.moveDown(0.5);
        return;
      }

      const heading = node.type === 'heading';

      document
        .moveDown(heading ? 1.1 : 0.45)
        .font(heading ? boldFont : regularFont)
        .fontSize(heading ? (node.attrs?.level === 3 ? 11.5 : 12.5) : 10)
        .fillColor('#202b3b')
        .text(prefix + text, { align: 'left', lineGap: 3 });
      return;
    }

    if (node.type === 'table') {
      document.moveDown(0.8).font(regularFont).fontSize(9);
      document.table({
        data: (node.content || []).map(row =>
          (row.content || []).map(cell => ({
            text: instructionBodyText(richTextToPlainText(cell)),
            rowSpan: cell.attrs?.rowspan || 1,
            colSpan: cell.attrs?.colspan || 1,
            type: cell.type === 'tableHeader' ? 'TH' : 'TD',
            font: { src: cell.type === 'tableHeader' ? boldFont : regularFont, size: 9 },
          })),
        ),
        defaultStyle: { padding: 5, border: 0.5, borderColor: '#7b8491' },
      });
      document.font(regularFont).fontSize(10).moveDown(0.5);
      return;
    }

    if (node.type === 'horizontalRule') {
      document.moveDown(0.7);
      document
        .moveTo(document.page.margins.left, document.y)
        .lineTo(document.page.width - document.page.margins.right, document.y)
        .stroke('#7b8491');
      document.moveDown(0.7);
      return;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const start = node.attrs?.start || 1;

      (node.content || []).forEach((item, index) => {
        const marker = node.type === 'orderedList' ? `${start + index}. ` : '• ';

        (item.content || []).forEach((child, childIndex) =>
          render(child, childIndex === 0 ? marker : ''),
        );
      });
      return;
    }

    for (const child of node.content || []) render(child);
  }

  render(content);
}

export function createInstructionPdfBuffer(
  instruction,
  { companyProfile, downloadedAt = new Date() } = {},
) {
  return new Promise((resolve, reject) => {
    const regularFont = findFont(REGULAR_FONT_CANDIDATES);

    if (!regularFont) {
      reject(new Error('Не найден шрифт для формирования PDF'));

      return;
    }

    const boldFont = findFont(BOLD_FONT_CANDIDATES) ?? regularFont;

    const title = normalizeText(instruction?.title) || 'Инструкция по охране труда';

    const intro = instructionBodyText(instruction?.intro);

    const sections = Array.isArray(instruction?.sections) ? instruction.sections : [];

    const document = new PDFDocument({
      size: 'A4',

      margins: {
        top: 56,

        right: 56,

        bottom: 56,

        left: 56,
      },

      info: {
        Title: title,

        Author: 'БОЙКОВГРУПП',

        Subject: 'Инструкция по охране труда',
      },
    });

    const chunks = [];

    document.on('data', chunk => {
      chunks.push(chunk);
    });

    document.on('error', reject);

    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    renderInstructionCompanyHeader(document, companyProfile, downloadedAt, {
      regularFont,
      boldFont,
    });

    document.font(boldFont).fontSize(18).fillColor('#172033').text(title, {
      align: 'left',

      lineGap: 3,
    });

    if (instruction.instructionContent?.type === 'doc') {
      renderRichInstruction(document, instruction.instructionContent, { regularFont, boldFont });
      renderInstructionCompanySignature(document, companyProfile, { regularFont, boldFont });
      document.end();
      return;
    }

    if (intro) {
      document.moveDown(1).font(regularFont).fontSize(10.5).fillColor('#39465a').text(intro, {
        align: 'justify',

        lineGap: 3,
      });
    }

    for (const section of sections) {
      const heading = sectionHeading(section);

      if (heading) {
        document.moveDown(1.35).font(boldFont).fontSize(12.5).fillColor('#172033').text(heading, {
          lineGap: 2,
        });
      }

      const paragraphs = Array.isArray(section?.paragraphs) ? section.paragraphs : [];

      for (const paragraph of paragraphs) {
        const text = instructionBodyText(paragraph);

        if (!text) {
          continue;
        }

        document.moveDown(0.45).font(regularFont).fontSize(10).fillColor('#202b3b').text(text, {
          align: 'justify',

          lineGap: 3,
        });
      }
    }

    renderInstructionCompanySignature(document, companyProfile, { regularFont, boldFont });
    document.end();
  });
}
