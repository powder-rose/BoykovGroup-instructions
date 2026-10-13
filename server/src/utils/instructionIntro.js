/*
 * ============================================================
 * UNIVERSAL INSTRUCTION INTRO
 * ============================================================
 *
 * Intro depends only on the final document title.
 *
 * Therefore it works equally for:
 *
 * - professions;
 * - positions;
 * - kinds of work;
 * - equipment operation;
 * - technological processes.
 */

export function buildInstructionIntro(title) {
  const normalizedTitle = String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/u, '');

  const safeTitle = normalizedTitle || 'Инструкция по охране труда';

  return (
    `${safeTitle} устанавливает требования безопасности, ` +
    `правила поведения на рабочем месте и порядок действий работника ` +
    `до начала, во время и после выполнения работ.`
  );
}
