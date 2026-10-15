import { ArticleError } from './articleErrors.js';
import { createInstructionPdfBuffer } from './instructionPdfService.js';

const MAX_CONTENT_CHARACTERS = 500_000;
const MAX_CONTENT_NODES = 10_000;
const MAX_CONTENT_DEPTH = 20;
const INSTRUCTION_ID = /^[a-zA-Z0-9_-]{8,80}$/u;
const INLINE_NODES = new Set(['text', 'hardBreak']);
const BLOCK_NODES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'table',
  'instruction',
]);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'underline']);

function invalid(message) {
  throw new ArticleError(message, { code: 'INVALID_ARTICLE_CONTENT' });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertAttributes(value) {
  if (value !== undefined && !isRecord(value)) {
    invalid('Некорректные параметры блока статьи');
  }

  return value ?? {};
}

export function normalizeArticleLink(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    invalid('Некорректный адрес ссылки');
  }

  const href = value.trim();

  if (!href || /[\s\\]/u.test(href)) {
    invalid('В адресе ссылки недопустимы пробелы и обратные слеши');
  }

  for (const character of href) {
    if (character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f) {
      invalid('Недопустимые символы в адресе ссылки');
    }
  }

  if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) {
    return href;
  }

  let parsed;

  try {
    parsed = new URL(href);
  } catch (cause) {
    throw new ArticleError('Укажите полный адрес ссылки или путь от корня сайта', {
      code: 'INVALID_ARTICLE_CONTENT',
      cause,
    });
  }

  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
    invalid('Этот тип ссылки не разрешён');
  }

  if (parsed.username || parsed.password) {
    invalid('Ссылки с логином и паролем не разрешены');
  }

  return href;
}

function normalizeMarks(marks) {
  if (marks === undefined) {
    return undefined;
  }

  if (!Array.isArray(marks) || marks.length > 6) {
    invalid('Некорректное форматирование текста');
  }

  const seen = new Set();

  return marks.map(mark => {
    if (!isRecord(mark) || seen.has(mark.type)) {
      invalid('Некорректное или повторяющееся форматирование текста');
    }

    seen.add(mark.type);

    if (SIMPLE_MARKS.has(mark.type)) {
      return { type: mark.type };
    }

    if (mark.type !== 'link') {
      invalid('Неизвестное форматирование текста');
    }

    const attrs = assertAttributes(mark.attrs);
    const normalized = { href: normalizeArticleLink(attrs.href) };

    if (attrs.title !== undefined && attrs.title !== null) {
      if (typeof attrs.title !== 'string' || attrs.title.length > 300) {
        invalid('Слишком длинная подпись ссылки');
      }

      normalized.title = attrs.title;
    }

    if (attrs.target !== undefined && attrs.target !== null) {
      if (!['_blank', '_self'].includes(attrs.target)) {
        invalid('Некорректный способ открытия ссылки');
      }

      normalized.target = attrs.target;
    }

    return { type: 'link', attrs: normalized };
  });
}

function normalizeCellAttributes(raw) {
  const attrs = assertAttributes(raw);
  const normalized = {};

  for (const name of ['colspan', 'rowspan']) {
    const value = attrs[name] ?? 1;

    if (!Number.isInteger(value) || value < 1 || value > 100) {
      invalid('Некорректный размер ячейки таблицы');
    }

    normalized[name] = value;
  }

  if (attrs.colwidth !== undefined && attrs.colwidth !== null) {
    if (
      !Array.isArray(attrs.colwidth) ||
      attrs.colwidth.length !== normalized.colspan ||
      attrs.colwidth.some(width => !Number.isInteger(width) || width < 1 || width > 2000)
    ) {
      invalid('Некорректная ширина ячейки таблицы');
    }

    normalized.colwidth = [...attrs.colwidth];
  }

  return normalized;
}

export function normalizeArticleContent(document) {
  let nodeCount = 0;
  let characterCount = 0;
  const instructionIds = new Set();

  function countText(value) {
    characterCount += value.length;

    if (characterCount > MAX_CONTENT_CHARACTERS) {
      invalid('Общий текст статьи не должен превышать 500 000 символов');
    }
  }

  function normalizeNode(node, parent, depth) {
    nodeCount += 1;

    if (depth > MAX_CONTENT_DEPTH || nodeCount > MAX_CONTENT_NODES) {
      invalid('Статья содержит слишком много вложенных блоков');
    }

    if (!isRecord(node) || typeof node.type !== 'string') {
      invalid('Некорректная структура статьи');
    }

    const { type } = node;

    if (!parent && type !== 'doc') {
      invalid('Статья должна содержать корневой документ');
    }

    const allowed =
      parent === null
        ? type === 'doc'
        : parent === 'doc'
          ? BLOCK_NODES.has(type) || type === 'instruction'
          : ['paragraph', 'heading'].includes(parent)
            ? INLINE_NODES.has(type)
            : ['bulletList', 'orderedList'].includes(parent)
              ? type === 'listItem'
              : parent === 'table'
                ? type === 'tableRow'
                : parent === 'tableRow'
                  ? ['tableCell', 'tableHeader'].includes(type)
                  : ['blockquote', 'listItem', 'tableCell', 'tableHeader'].includes(parent)
                    ? BLOCK_NODES.has(type)
                    : false;

    if (!allowed) {
      invalid('Недопустимое вложение блоков статьи');
    }

    const attrs = assertAttributes(node.attrs);
    const result = { type };

    if (type === 'text') {
      if (typeof node.text !== 'string' || node.text.length === 0 || node.content !== undefined) {
        invalid('Некорректный текстовый блок');
      }

      countText(node.text);
      result.text = node.text;
      const marks = normalizeMarks(node.marks);

      if (marks?.length) {
        result.marks = marks;
      }

      return result;
    }

    if (
      type !== 'hardBreak' &&
      node.marks !== undefined &&
      (!Array.isArray(node.marks) || node.marks.length > 0)
    ) {
      invalid('Форматирование допустимо только внутри текстового блока');
    }

    if (type === 'instruction') {
      if (
        typeof attrs.id !== 'string' ||
        !INSTRUCTION_ID.test(attrs.id) ||
        instructionIds.has(attrs.id)
      ) {
        invalid('Каждый блок инструкции должен иметь уникальный идентификатор');
      }

      if (
        typeof attrs.title !== 'string' ||
        !attrs.title.trim() ||
        attrs.title.length > 200 ||
        typeof attrs.text !== 'string' ||
        !attrs.text.trim()
      ) {
        invalid('Укажите название и полный текст инструкции; название — не длиннее 200 символов');
      }

      if (node.content !== undefined) {
        invalid('Инструкция хранит собственный текст без вложенных блоков');
      }

      instructionIds.add(attrs.id);
      countText(attrs.title);
      countText(attrs.text);
      result.attrs = { id: attrs.id, title: attrs.title.trim(), text: attrs.text };

      return result;
    }

    if (['hardBreak', 'horizontalRule'].includes(type)) {
      if (node.content !== undefined) {
        invalid('Этот блок не может содержать вложенные блоки');
      }

      if (type === 'hardBreak') {
        const marks = normalizeMarks(node.marks);

        if (marks?.length) {
          result.marks = marks;
        }
      }

      return result;
    }

    if (type === 'heading') {
      if (![2, 3].includes(attrs.level)) {
        invalid('Используйте заголовки второго или третьего уровня');
      }

      result.attrs = { level: attrs.level };
    }

    if (type === 'orderedList') {
      const start = attrs.start ?? 1;

      if (!Number.isInteger(start) || start < 1 || start > 10_000) {
        invalid('Некорректная нумерация списка');
      }

      result.attrs = { start };
    }

    if (['tableCell', 'tableHeader'].includes(type)) {
      result.attrs = normalizeCellAttributes(attrs);
    }

    if (node.content !== undefined && !Array.isArray(node.content)) {
      invalid('Некорректный список блоков статьи');
    }

    const content = node.content ?? [];

    if (
      !['doc', 'paragraph', 'heading'].includes(type) &&
      (content.length === 0 || (type === 'listItem' && content[0]?.type !== 'paragraph'))
    ) {
      invalid('Этот блок должен содержать текст или вложенные элементы');
    }

    result.content = content.map(child => normalizeNode(child, type, depth + 1));

    return result;
  }

  return normalizeNode(document, null, 0);
}

export function findInstructionBlock(document, id) {
  if (document?.type === 'instruction' && document.attrs?.id === id) {
    return document;
  }

  for (const child of document?.content ?? []) {
    const found = findInstructionBlock(child, id);

    if (found) {
      return found;
    }
  }

  return null;
}

export function createArticleInstructionPdf(block) {
  const document = normalizeArticleContent({ type: 'doc', content: [block] });
  const instruction = document.content[0];

  if (instruction.type !== 'instruction') {
    invalid('Блок инструкции не найден');
  }

  return createInstructionPdfBuffer({
    title: instruction.attrs.title,
    sections: [{ paragraphs: [instruction.attrs.text] }],
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderArticleContentToHtml(document) {
  const normalized = normalizeArticleContent(document);

  function renderNode(node) {
    const inner = () => (node.content ?? []).map(renderNode).join('');

    if (node.type === 'text') {
      let html = escapeHtml(node.text);
      const tags = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' };

      for (const mark of node.marks ?? []) {
        if (mark.type === 'link') {
          const { href, title, target } = mark.attrs;
          const titleAttr = title === undefined ? '' : ` title="${escapeHtml(title)}"`;
          const targetAttr = target ? ` target="${escapeHtml(target)}"` : '';
          const relAttr = target === '_blank' ? ' rel="noopener noreferrer"' : '';

          html = `<a href="${escapeHtml(href)}"${titleAttr}${targetAttr}${relAttr}>${html}</a>`;
        } else {
          const tag = tags[mark.type];

          html = `<${tag}>${html}</${tag}>`;
        }
      }

      return html;
    }

    if (node.type === 'instruction') {
      const { id, title, text } = node.attrs;

      return (
        `<section class="article-instruction" data-instruction-id="${escapeHtml(id)}" ` +
        `aria-labelledby="instruction-${escapeHtml(id)}">` +
        '<span class="article-instruction__label">Инструкция</span>' +
        `<h2 id="instruction-${escapeHtml(id)}">${escapeHtml(title)}</h2>` +
        `<div class="article-instruction__text" style="white-space:pre-wrap">${escapeHtml(text)}</div>` +
        `<button type="button" class="article-instruction__download" ` +
        `data-article-instruction-download="${escapeHtml(id)}">Скачать PDF</button>` +
        '<noscript>Для скачивания PDF включите JavaScript и войдите в аккаунт с подтверждённым e-mail.</noscript>' +
        '</section>'
      );
    }

    const tags = {
      paragraph: 'p',
      bulletList: 'ul',
      orderedList: 'ol',
      listItem: 'li',
      blockquote: 'blockquote',
      tableRow: 'tr',
      tableCell: 'td',
      tableHeader: 'th',
    };

    if (node.type === 'doc') return inner();
    if (node.type === 'hardBreak') return '<br>';
    if (node.type === 'horizontalRule') return '<hr>';
    if (node.type === 'heading') return `<h${node.attrs.level}>${inner()}</h${node.attrs.level}>`;
    if (node.type === 'table') return `<table><tbody>${inner()}</tbody></table>`;

    let attributes = '';

    if (node.type === 'orderedList') {
      attributes = ` start="${node.attrs.start}"`;
    }

    if (['tableCell', 'tableHeader'].includes(node.type)) {
      attributes = ` colspan="${node.attrs.colspan}" rowspan="${node.attrs.rowspan}"`;
    }

    const tag = tags[node.type];

    return `<${tag}${attributes}>${inner()}</${tag}>`;
  }

  return renderNode(normalized);
}
