import { getFailedImportFiles, updateImportFile, updateImport } from './importHistoryService.js';

import { readImportFile } from './importFileStorage.js';

import { extractTextFromUpload } from './documentTextExtractor.js';

import {
  cleanDocumentText,
  normalizeProfession,
  buildInstructionTitle,
} from './documentCleanerService.js';

import { parseImportedInstruction } from './importedInstructionParser.js';

import { assertInstructionQuality } from './instructionQualityChecker.js';

import { instructionsRepository } from './instructionsRepository.js';
import { saveInstructionWithTaxonomy } from './instructionTaxonomyPersistence.js';

import { nanoid } from 'nanoid';

import { slugify } from '../utils/slug.js';

export async function retryFailedImport(importId) {
  const failedFiles = getFailedImportFiles(importId);

  if (!failedFiles.length) {
    throw new Error('Нет файлов для повторной обработки');
  }

  updateImport(importId, {
    status: 'processing',
  });

  for (const file of failedFiles) {
    try {
      updateImportFile(importId, file.id, {
        status: 'processing',
        startedAt: new Date().toISOString(),
        error: null,
      });

      const buffer = await readImportFile(importId, file.name);

      const rawText = await extractTextFromUpload({
        buffer,

        originalName: file.name,
      });

      const cleanedText = cleanDocumentText(rawText);

      const profession = normalizeProfession(file.name, cleanedText);

      const parsed = parseImportedInstruction(cleanedText);

      if (!parsed.sections.length) {
        throw new Error('Не удалось распознать разделы и нумерованные пункты инструкции');
      }

      const finalProfession = profession;

      const instruction = {
        id: `${slugify(buildInstructionTitle(finalProfession))}-${nanoid(6)}`,

        title: buildInstructionTitle(finalProfession),

        profession: finalProfession,

        intro:
          'Инструкция устанавливает требования охраны труда при выполнении работ по профессии.',

        sections: parsed.sections,

        source: 'retry-import',

        uploadedBy: 'admin',

        version: '1.0',

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),
      };

      try {
        assertInstructionQuality(instruction);
      } catch (error) {
        const details = Array.isArray(error?.qualityErrors)
          ? error.qualityErrors.join('; ')
          : error.message;

        console.warn(`[Retry import quality warning] ${file.name}: ${details}`);
      }

      /*
       * ВАЖНО:
       * импортированный документ не ремонтируем
       * и ничего в него через AI не дописываем.
       */
      saveInstructionWithTaxonomy(instructionsRepository, instruction);

      updateImportFile(importId, file.id, {
        status: 'completed',
        instructionId: instruction.id,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      updateImportFile(importId, file.id, {
        status: 'failed',
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
    }
  }
}
