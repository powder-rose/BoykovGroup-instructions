import { normalizeUploadedFilename } from '../utils/uploadedFilename.js';

import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_DIR = path.resolve('uploads/imports');

export async function saveImportFile(importId, file) {
  const folder = path.join(STORAGE_DIR, importId);

  await fs.mkdir(folder, {
    recursive: true,
  });

  const filePath = path.join(folder, normalizeUploadedFilename(file.originalname));

  await fs.writeFile(filePath, file.buffer);

  return filePath;
}

export function getImportFilePath(importId, filename) {
  return path.join(
    STORAGE_DIR,

    importId,

    filename,
  );
}

export async function readImportFile(importId, filename) {
  const filePath = getImportFilePath(importId, filename);

  return fs.readFile(filePath);
}
