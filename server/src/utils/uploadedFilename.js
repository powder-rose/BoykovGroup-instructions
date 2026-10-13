/**
 * Исправляет имя файла, если UTF-8 байты были ошибочно
 * интерпретированы multipart-парсером как latin1.
 *
 * Например:
 *
 * Ð˜Ð½ÑÑ‚Ñ€ÑƒÐºÑ†Ð¸Ñ.docx
 *
 * превращается обратно в:
 *
 * Инструкция.docx
 */
export function normalizeUploadedFilename(value = '') {
  const original = String(value ?? '').trim();

  if (!original) {
    return '';
  }

  /*
   * Типичные признаки UTF-8 -> latin1 mojibake
   * для русского текста.
   */
  if (!/[ÐÑ]/.test(original)) {
    return original;
  }

  try {
    const decoded = Buffer.from(original, 'latin1').toString('utf8');

    /*
     * Если декодирование дало replacement character,
     * лучше сохранить исходную строку.
     */
    if (!decoded || decoded.includes('\uFFFD')) {
      return original;
    }

    return decoded;
  } catch {
    return original;
  }
}
