// Shared by the API and the browser so legacy documents, anchors and SEO agree.
const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] };

function textValue(value) {
  return typeof value === 'string' ? value : String(value?.text ?? value?.content ?? '');
}

function paragraph(text) {
  const content = [];
  String(text ?? '')
    .split(/\r?\n/u)
    .forEach((line, index) => {
      if (index) content.push({ type: 'hardBreak' });
      if (line) content.push({ type: 'text', text: line });
    });
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
}

export function getInstructionDocument(instruction = {}) {
  if (instruction.instructionContent?.type === 'doc') return instruction.instructionContent;

  const content = [];
  if (instruction.intro) content.push(paragraph(instruction.intro));
  const sections = Array.isArray(instruction.sections) ? instruction.sections : [];
  for (const [index, section] of sections.entries()) {
    if (!section || typeof section !== 'object') continue;
    const number = section.number ?? index + 1;
    let heading = textValue(section.heading || section.title || section.name).trim();
    if (!heading) heading = `Раздел ${number}`;
    else if (!/^\d+(?:\.|\s)/u.test(heading)) heading = `${number}. ${heading}`;
    content.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: heading }],
    });
    const paragraphs = Array.isArray(section.paragraphs)
      ? section.paragraphs
      : Array.isArray(section.items)
        ? section.items
        : [];
    content.push(...paragraphs.map(value => paragraph(textValue(value))));
  }
  return content.length ? { type: 'doc', content } : structuredClone(EMPTY_DOCUMENT);
}

export function richTextToPlainText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
  if (node.type === 'hardBreak') return '\n';
  const children = Array.isArray(node.content) ? node.content : [];
  if (node.type === 'orderedList' || node.type === 'bulletList') {
    const start = Number.isInteger(node.attrs?.start) ? node.attrs.start : 1;
    return children
      .map((child, index) => {
        const marker = node.type === 'orderedList' ? `${start + index}.` : '•';
        return `${marker} ${richTextToPlainText(child)}`;
      })
      .join('\n');
  }
  const separator = ['paragraph', 'heading'].includes(node.type)
    ? ''
    : node.type === 'tableRow'
      ? '\t'
      : '\n';
  return children.map(richTextToPlainText).join(separator);
}

export function getInstructionOutline(document, prefix = 'instruction-section') {
  const outline = [];
  let headingIndex = 0;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'heading') {
      headingIndex += 1;
      const label = richTextToPlainText(node).trim();
      if (label)
        outline.push({
          id: `${prefix}-${headingIndex}`,
          label,
          level: node.attrs?.level === 3 ? 3 : 2,
        });
    }
    for (const child of node.content || []) visit(child);
  }
  visit(document);
  return outline;
}

// The rich document is authoritative. This projection keeps older catalog,
// import and account consumers readable without mixing in web-only prose.
export function instructionDocumentToLegacy(document) {
  const introduction = [];
  const sections = [];
  let current = null;
  for (const node of document?.content || []) {
    const text = richTextToPlainText(node).trim();
    if (node.type === 'heading' && text) {
      const match = text.match(/^(\d+)[.)]\s+(.+)$/u);
      current = {
        number: match ? Number(match[1]) : sections.length + 1,
        heading: match ? match[2] : text,
        paragraphs: [],
      };
      sections.push(current);
    } else if (text) {
      (current ? current.paragraphs : introduction).push(text);
    }
  }
  return { intro: introduction.join('\n\n'), sections };
}

export function getInstructionPublicPath(instruction) {
  return `/instrukciya-po-ohrane-truda/${encodeURIComponent(instruction?.slug || instruction?.id || '')}`;
}

export function getInstructionSeo(instruction = {}) {
  const heading = String(instruction.title || 'Инструкция по охране труда').trim();
  return {
    title: String(instruction.seoTitle || '').trim() || `${heading} | БОЙКОВГРУПП`,
    description:
      String(instruction.seoDescription || '').trim() ||
      `${heading}. Полный текст инструкции и скачивание PDF после регистрации.`,
  };
}
