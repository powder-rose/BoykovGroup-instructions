import { instructionsRepository } from './instructionsRepository.js';

/**
 * Проверка инструкции на дубликат
 */
export function checkInstructionDuplicate(instruction) {
  const existing = instructionsRepository.findByProfessionKey(instruction.professionKey);

  // профессии ещё нет
  if (!existing) {
    return {
      action: 'new',

      instruction,
    };
  }

  // профессия есть и текст одинаковый
  if (existing.contentHash && existing.contentHash === instruction.contentHash) {
    return {
      action: 'duplicate',

      instruction: existing,
    };
  }

  // профессия есть, текст изменился
  return {
    action: 'new_version',

    instruction: instruction,

    previous: existing,
  };
}
