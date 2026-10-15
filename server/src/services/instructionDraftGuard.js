import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstructionEditorError } from './instructionEditorError.js';

const DRAFT_DIRECTORY = fileURLToPath(new URL('../data/instruction-drafts/', import.meta.url));

export function hasPendingInstructionDraft(instruction, { directory = DRAFT_DIRECTORY } = {}) {
  const filename = `${Buffer.from(String(instruction.id), 'utf8').toString('base64url')}.json`;

  try {
    const draft = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));

    return Number(draft.revision) > Number(instruction.revision || 0);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function assertNoPendingInstructionDraft(instruction) {
  if (hasPendingInstructionDraft(instruction)) {
    throw new InstructionEditorError(
      'У инструкции есть черновик. Сначала опубликуйте или удалите его.',
      {
        status: 409,
        code: 'INSTRUCTION_DRAFT_CONFLICT',
      },
    );
  }
}
