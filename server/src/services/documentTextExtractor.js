import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);

/**
 *        
 * .txt/.md (  ), .pdf (pdf-parse)  .docx (mammoth).
 *   .doc     mammoth  
 *   .docx,   .doc    .
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
      " .doc ( Word)        .docx  .pdf,    ."
    );
  }

  throw new Error(
    `   (${ext || mimetype || ""}). : .txt, .md, .pdf, .docx.`
  );
}

/**
 *     . PDF    
 *          ,
 *       ,   .
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
