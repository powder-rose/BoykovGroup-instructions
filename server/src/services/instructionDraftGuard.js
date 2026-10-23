import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { InstructionEditorError } from './instructionEditorError.js';

const DRAFT_DIRECTORY = fileURLToPath(new URL('../data/instruction-drafts/', import.meta.url));

export function hasPendingInstructionDraft(instruction, { directory = DRAFT_DIRECTORY } = {}) {
  const filename = `${Buffer.from(String(instruction.id), 'utf8').toString('base64url')}.json`;

  try {
    const file = path.join(directory, filename);
    if (!fs.lstatSync(file).isFile()) throw new Error('Non-regular instruction draft');
    const draft = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)),
    );
    if (
      !draft ||
      typeof draft !== 'object' ||
      Array.isArray(draft) ||
      draft.id !== instruction.id ||
      !Number.isSafeInteger(draft.revision) ||
      draft.revision < 1 ||
      draft.status !== 'draft'
    ) {
      throw new Error('Invalid instruction draft');
    }

    return draft.revision > Number(instruction.revision || 0);
  } catch (cause) {
    if (cause.code === 'ENOENT') return false;
    throw new InstructionEditorError('Не удалось прочитать черновик инструкции', {
      status: 500,
      code: 'INSTRUCTION_DRAFT_STORAGE_ERROR',
      cause,
    });
  }
}

export function assertNoPendingInstructionDraft(instruction, options) {
  if (hasPendingInstructionDraft(instruction, options)) {
    throw new InstructionEditorError(
      'У инструкции есть черновик. Сначала опубликуйте или удалите его.',
      {
        status: 409,
        code: 'INSTRUCTION_DRAFT_CONFLICT',
      },
    );
  }
}
