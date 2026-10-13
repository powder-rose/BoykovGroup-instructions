import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';

import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

import {
  getBulkImportStatusDir,
  assertBulkImportId,
} from '../services/bulkImportStorageService.js';

export const BULK_UPLOAD_CHUNK_SIZE = 20;

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md']);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    try {
      const batchId = assertBulkImportId(req.params.id);

      const destination = getBulkImportStatusDir(batchId, 'pending');

      fs.mkdir(
        destination,
        {
          recursive: true,
        },
        error => callback(error, destination),
      );
    } catch (error) {
      callback(error);
    }
  },

  filename(req, file, callback) {
    const original = normalizeUploadedFilename(file.originalname);

    const extension = path.extname(original).toLocaleLowerCase('ru-RU');

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(new Error(`Неподдерживаемый формат файла: ${extension || 'без расширения'}`));
    }

    const fileId = crypto.randomUUID();

    file.bulkImportFileId = fileId;

    callback(null, `${fileId}${extension}`);
  },
});

export const bulkImportUpload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,

    files: BULK_UPLOAD_CHUNK_SIZE,
  },

  fileFilter(req, file, callback) {
    const original = normalizeUploadedFilename(file.originalname);

    const extension = path.extname(original).toLocaleLowerCase('ru-RU');

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(new Error(`Формат ${extension || 'без расширения'} не поддерживается`));
    }

    callback(null, true);
  },
});

export async function cleanupBulkUploadFiles(files = []) {
  await Promise.allSettled(files.map(file => fsPromises.unlink(file.path)));
}
