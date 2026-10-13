import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';

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
  const heading = normalizeText(section?.heading);

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

export function createInstructionPdfBuffer(instruction) {
  return new Promise((resolve, reject) => {
    const regularFont = findFont(REGULAR_FONT_CANDIDATES);

    if (!regularFont) {
      reject(new Error('Не найден шрифт для формирования PDF'));

      return;
    }

    const boldFont = findFont(BOLD_FONT_CANDIDATES) ?? regularFont;

    const title = normalizeText(instruction?.title) || 'Инструкция по охране труда';

    const intro = normalizeText(instruction?.intro);

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

    document.font(boldFont).fontSize(18).fillColor('#172033').text(title, {
      align: 'left',

      lineGap: 3,
    });

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
        const text = normalizeText(paragraph);

        if (!text) {
          continue;
        }

        document.moveDown(0.45).font(regularFont).fontSize(10).fillColor('#202b3b').text(text, {
          align: 'justify',

          lineGap: 3,
        });
      }
    }

    document.end();
  });
}
