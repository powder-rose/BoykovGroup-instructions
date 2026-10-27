import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

import { getInstructionDocument } from '../shared/instructionDocument.js';
import { instructionBoilerplateRanges } from './instructionDownloadText.js';
import { formatInstructionDownloadDate } from './instructionPdfCompanyLayout.js';

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const text = value =>
  String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
const field = value => text(value) || '__________________';
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };

function inlineRuns(node, { bold = false } = {}) {
  const leaves = [];
  function visit(value) {
    if (value.type === 'text') leaves.push({ text: value.text || '', marks: value.marks || [] });
    else if (value.type === 'hardBreak') leaves.push({ text: '\n', marks: [] });
    else for (const child of value.content || []) visit(child);
  }
  visit(node);
  const ranges = instructionBoilerplateRanges(leaves.map(leaf => leaf.text).join(''));
  let offset = 0;
  return leaves.flatMap(leaf => {
    const start = offset;
    offset += leaf.text.length;
    let value = '';
    for (let index = 0; index < leaf.text.length; index += 1) {
      if (!ranges.some(range => start + index >= range.start && start + index < range.end))
        value += leaf.text[index];
    }
    if (!value) return [];
    const marks = new Set(leaf.marks.map(mark => mark.type));
    const children = value.split('\n').flatMap((line, index) => [
      ...(index ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        bold: bold || marks.has('bold') || undefined,
        italics: marks.has('italic') || undefined,
        underline: marks.has('underline') ? {} : undefined,
        strike: marks.has('strike'),
        superScript: marks.has('superscript'),
        subScript: marks.has('subscript'),
      }),
    ]);
    const href = leaf.marks.find(mark => mark.type === 'link')?.attrs?.href;
    return typeof href === 'string' && /^https?:\/\//iu.test(href)
      ? [new ExternalHyperlink({ link: href, children })]
      : children;
  });
}

function companyHeader(profile, downloadedAt) {
  const approval = value =>
    new Paragraph({
      children: [new TextRun(value)],
      indent: { left: 4900 },
      spacing: { after: 100 },
      keepNext: true,
    });
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `${field(profile?.companyName)}, ИНН ${field(profile?.inn)}`,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      keepNext: true,
    }),
    approval({ text: 'УТВЕРЖДАЮ', bold: true }),
    approval(field(profile?.headPosition)),
    approval(`__________  ${field(profile?.headFullName)}`),
    approval(formatInstructionDownloadDate(downloadedAt)),
  ];
}

export async function createInstructionDocxBuffer(
  instruction,
  { companyProfile, downloadedAt = new Date() } = {},
) {
  const numbering = [];

  function render(node, { depth = 0, number, bold = false } = {}) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const children = inlineRuns(node, { bold });
      const original = (node.content || []).length;
      if (!children.length && original) return [];
      const heading = node.type === 'heading';
      const alignment = {
        left: AlignmentType.LEFT,
        center: AlignmentType.CENTER,
        right: AlignmentType.RIGHT,
        justify: AlignmentType.JUSTIFIED,
      }[node.attrs?.textAlign];
      return [
        new Paragraph({
          children,
          heading: heading
            ? node.attrs?.level === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_2
            : undefined,
          numbering: number,
          alignment: alignment || AlignmentType.LEFT,
          spacing: { before: heading ? 220 : 0, after: heading ? 140 : 100 },
          keepNext: heading,
        }),
      ];
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const reference = `instruction-list-${numbering.length}`;
      numbering.push({
        reference,
        levels: [
          {
            level: 0,
            format: node.type === 'orderedList' ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: node.type === 'orderedList' ? '%1.' : '•',
            start: Number.isInteger(node.attrs?.start) ? node.attrs.start : 1,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420 * (depth + 1), hanging: 280 } } },
          },
        ],
      });
      return (node.content || []).flatMap(item =>
        (item.content || []).flatMap((child, index) =>
          render(child, {
            depth: depth + 1,
            number: index === 0 ? { reference, level: 0 } : undefined,
            bold,
          }),
        ),
      );
    }
    if (node.type === 'table') {
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: border,
            bottom: border,
            left: border,
            right: border,
            insideHorizontal: border,
            insideVertical: border,
          },
          rows: (node.content || []).map(
            row =>
              new TableRow({
                tableHeader: (row.content || []).every(cell => cell.type === 'tableHeader'),
                children: (row.content || []).map(cell => {
                  const children = (cell.content || []).flatMap(child =>
                    render(child, { bold: cell.type === 'tableHeader' }),
                  );
                  if (!children.length || children.at(-1) instanceof Table)
                    children.push(new Paragraph(''));
                  return new TableCell({
                    children,
                    columnSpan: cell.attrs?.colspan || 1,
                    rowSpan: cell.attrs?.rowspan || 1,
                    verticalAlign: VerticalAlign.CENTER,
                    shading: cell.type === 'tableHeader' ? { fill: 'F1F3F5' } : undefined,
                    margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  });
                }),
              }),
          ),
        }),
        new Paragraph({ spacing: { after: 100 } }),
      ];
    }
    if (node.type === 'horizontalRule')
      return [new Paragraph({ border: { bottom: border }, spacing: { after: 160 } })];
    return (node.content || []).flatMap(child => render(child, { depth, bold }));
  }

  const body = render(getInstructionDocument(instruction));
  const document = new Document({
    creator: 'БОЙКОВГРУПП',
    title: text(instruction?.title) || 'Инструкция по охране труда',
    description: 'Инструкция по охране труда',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '000000' },
          paragraph: { spacing: { after: 100, line: 276 }, widowControl: true },
        },
        title: { run: { font: 'Arial', size: 32, bold: true, color: '000000' } },
        heading2: { run: { font: 'Arial', size: 25, bold: true, color: '000000' } },
        heading3: { run: { font: 'Arial', size: 23, bold: true, color: '000000' } },
      },
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: [
          ...companyHeader(companyProfile, downloadedAt),
          new Paragraph({
            text: text(instruction?.title) || 'Инструкция по охране труда',
            heading: HeadingLevel.TITLE,
            spacing: { before: 280, after: 300 },
            keepNext: true,
          }),
          ...body,
          new Paragraph({
            children: [
              new TextRun(
                `${field(companyProfile?.occupationalSafetyPosition)}   __________   ${field(companyProfile?.occupationalSafetyFullName)}`,
              ),
            ],
            spacing: { before: 360 },
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
