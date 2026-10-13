import path from 'node:path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import iconv from 'iconv-lite';

const PLAIN_TEXT_EXTENSIONS = new Set(['.txt', '.md']);

function decodeText(buffer) {
  let text = buffer.toString('utf-8');

  // Если появились символы замены — пробуем Windows-1251
  if (text.includes('�') || /Р[А-Яа-я]/.test(text)) {
    text = iconv.decode(buffer, 'win1251');
  }

  return text;
}

function normalizeFileName(name = '') {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');

    if (decoded.includes('�')) {
      return name;
    }

    return decoded;
  } catch {
    return name;
  }
}

export async function extractTextFromUpload({ buffer, originalName, mimetype }) {
  const ext = path.extname(originalName || '').toLowerCase();

  if (PLAIN_TEXT_EXTENSIONS.has(ext) || (mimetype ?? '').startsWith('text/')) {
    return decodeText(buffer);
  }

  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);

    return data.text;
  }

  if (
    ext === '.docx' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({
      buffer,
    });

    return result.value;
  }

  if (ext === '.doc' || mimetype === 'application/msword') {
    throw new Error('.doc не поддерживается. Используйте .docx или .pdf.');
  }

  throw new Error(`Формат ${ext || mimetype || ''} не поддерживается`);
}

export function normalizeUploadedFileName(name) {
  return normalizeFileName(name);
}

export function splitIntoParagraphs(text) {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalized) {
    return [];
  }

  let parts = normalized.split(/\n{2,}/);

  if (parts.length <= 1) {
    parts = normalized.split(/\n/);
  }

  return parts

    .map(p => p.replace(/[ \t]+/g, ' ').trim())

    .filter(Boolean);
}
