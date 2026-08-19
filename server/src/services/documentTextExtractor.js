import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);

/**
 * Извлекает обычный текст из загруженного файла — поддерживаются
 * .txt/.md (читаются как есть), .pdf (pdf-parse) и .docx (mammoth).
 * Старый бинарный .doc не поддерживается напрямую — mammoth умеет работать
 * только с .docx, поэтому для .doc сразу возвращаем понятную ошибку.
 */
export async function extractTextFromUpload({ buffer, originalName, mimetype }) {
  const ext = path.extname(originalName || "").toLowerCase();

  if (PLAIN_TEXT_EXTENSIONS.has(ext) || (mimetype ?? "").startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf" || mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    ext === ".docx" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".doc" || mimetype === "application/msword") {
    throw new Error(
      "Формат .doc (старый Word) не поддерживается напрямую — пересохраните файл в .docx или .pdf, либо вставьте текст вручную."
    );
  }

  throw new Error(
    `Неподдерживаемый формат файла (${ext || mimetype || "неизвестно"}). Поддерживаются: .txt, .md, .pdf, .docx.`
  );
}

/**
 * Делит извлечённый текст на абзацы. PDF часто теряет структуру пустых
 * строк между абзацами — если двойных переводов строк не нашлось,
 * делим по одиночным переводам как более грубый, но рабочий вариант.
 */
export function splitIntoParagraphs(text) {
  const normalized = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!normalized) return [];

  let parts = normalized.split(/\n{2,}/);
  if (parts.length <= 1) {
    parts = normalized.split(/\n/);
  }

  return parts.map((p) => p.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}
