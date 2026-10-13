/**
 * Проверка качества инструкции после обработки YandexGPT
 *
 * Проверяет:
 * - корректность названия;
 * - наличие профессии;
 * - наличие обязательных разделов;
 * - объём текста;
 * - пустые разделы;
 * - повторяющиеся абзацы.
 */

const REQUIRED_SECTION_KEYWORDS = [
  ['общ', 'требован'],
  ['начал', 'работ'],
  ['во время', 'работ'],
  ['авар', 'ситуац'],
  ['оконч', 'работ'],
];

export function checkInstructionQuality(instruction) {
  const errors = [];

  if (!instruction) {
    return {
      isValid: false,
      errors: ['Инструкция отсутствует'],
    };
  }

  // ==========================
  // TITLE
  // ==========================

  if (!instruction.title || instruction.title.trim().length < 10) {
    errors.push('Отсутствует корректное название');
  }

  if (
    instruction.title &&
    !instruction.title.toLowerCase().includes('инструкция по охране труда')
  ) {
    errors.push('Название не соответствует стандартному формату');
  }

  // ==========================
  // PROFESSION
  // ==========================

  if (!instruction.profession || instruction.profession.trim().length < 2) {
    errors.push('Не определена профессия');
  }

  // ==========================
  // SECTIONS
  // ==========================

  if (!Array.isArray(instruction.sections) || instruction.sections.length < 5) {
    errors.push('Недостаточно разделов инструкции');
  }

  if (Array.isArray(instruction.sections)) {
    REQUIRED_SECTION_KEYWORDS.forEach((keywords, index) => {
      const exists = instruction.sections.some(section => {
        const heading = String(section.heading || '').toLowerCase();

        return keywords.every(word => heading.includes(word));
      });

      if (!exists) {
        errors.push(`Отсутствует обязательный раздел №${index + 1}`);
      }
    });
  }

  // ==========================
  // TEXT SIZE
  // ==========================

  let totalCharacters = 0;

  if (Array.isArray(instruction.sections)) {
    for (const section of instruction.sections) {
      if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
        errors.push(`Раздел "${section.heading}" пустой`);

        continue;
      }

      section.paragraphs.forEach(paragraph => {
        totalCharacters += String(paragraph).length;
      });
    }
  }

  if (totalCharacters < 1500) {
    errors.push('Объём инструкции слишком маленький');
  }

  // ==========================
  // DUPLICATES
  // ==========================

  const paragraphs = [];

  instruction.sections?.forEach(section => {
    section.paragraphs?.forEach(paragraph => {
      paragraphs.push(paragraph.trim());
    });
  });

  const uniqueParagraphs = new Set(paragraphs);

  if (uniqueParagraphs.size !== paragraphs.length) {
    errors.push('Обнаружены повторяющиеся абзацы');
  }

  return {
    isValid: errors.length === 0,

    errors,

    score: calculateQualityScore(errors.length),
  };
}

function calculateQualityScore(errorCount) {
  if (errorCount === 0) {
    return 100;
  }

  if (errorCount === 1) {
    return 90;
  }

  if (errorCount === 2) {
    return 75;
  }

  if (errorCount <= 4) {
    return 50;
  }

  return 20;
}

/**
 * Удобная проверка перед сохранением
 */

export function assertInstructionQuality(instruction) {
  const result = checkInstructionQuality(instruction);

  if (!result.isValid) {
    const error = new Error('Инструкция не прошла проверку качества: ' + result.errors.join('; '));

    error.qualityErrors = result.errors;

    throw error;
  }

  return instruction;
}
