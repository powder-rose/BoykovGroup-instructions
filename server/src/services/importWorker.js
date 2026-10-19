import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

import { processInstructionFile } from './instructionProcessingService.js';

import { instructionsRepository } from './instructionsRepository.js';
import { saveInstructionWithTaxonomy } from './instructionTaxonomyPersistence.js';

import { updateImportFile } from './importHistoryService.js';

import { createNewVersion } from './instructionVersionService.js';

export async function processImportFile({
  importId,

  importFile,

  file,
}) {
  try {
    updateImportFile(
      importId,

      importFile.id,

      {
        status: 'processing',

        startedAt: new Date().toISOString(),
      },
    );

    const result = await processInstructionFile({
      buffer: file.buffer,

      filename: normalizeUploadedFilename(file.originalname),

      mimetype: file.mimetype,

      source: 'uploaded',
    });

    let savedInstruction = null;

    switch (result.action) {
      // =====================
      // НОВАЯ ИНСТРУКЦИЯ
      // =====================

      case 'new':
        savedInstruction = saveInstructionWithTaxonomy(instructionsRepository, result.instruction);

        break;

      // =====================
      // ДУБЛИКАТ
      // =====================

      case 'duplicate':
        savedInstruction = result.instruction;

        break;

      // =====================
      // НОВАЯ ВЕРСИЯ
      // =====================

      case 'new_version': {
        const versioned = createNewVersion(result.previous, result.instruction);

        savedInstruction = saveInstructionWithTaxonomy(instructionsRepository, versioned);

        break;
      }

      default:
        throw new Error(`Неизвестное действие импорта: ${result.action}`);
    }

    updateImportFile(
      importId,

      importFile.id,

      {
        status: 'completed',

        instructionId: savedInstruction.id,

        action: result.action,

        finishedAt: new Date().toISOString(),
      },
    );

    return savedInstruction;
  } catch (error) {
    updateImportFile(
      importId,

      importFile.id,

      {
        status: 'failed',

        error: error.message,

        finishedAt: new Date().toISOString(),
      },
    );

    throw error;
  }
}
