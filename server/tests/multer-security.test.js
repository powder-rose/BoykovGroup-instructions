import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const instructionsRoutePath = path.join(serverRoot, 'src', 'routes', 'instructions.js');

const bulkUploadPath = path.join(serverRoot, 'src', 'middleware', 'bulkImportUpload.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function startApp(configure) {
  const app = express();

  configure(app);

  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);

    server.once('error', reject);
  });

  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,

    async close() {
      if (!server.listening) {
        return;
      }

      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);

            return;
          }

          resolve();
        });
      });
    },
  };
}

test('Multer security baseline is pinned to 2.4.0', () => {
  const packageJson = readJson(path.join(serverRoot, 'node_modules', 'multer', 'package.json'));

  assert.equal(
    packageJson.version,
    '2.4.0',
    'BoykovDocs must use Multer 2.4.0 or a separately audited replacement',
  );
});

test('project upload routes retain explicit file limits', () => {
  const instructionsSource = fs.readFileSync(instructionsRoutePath, 'utf8');

  const bulkSource = fs.readFileSync(bulkUploadPath, 'utf8');

  assert.match(instructionsSource, /const MAX_UPLOAD_SIZE_BYTES = 15 \* 1024 \* 1024;/u);

  assert.match(instructionsSource, /multer\.memoryStorage\(\)/u);

  assert.match(instructionsSource, /upload\.array\('files', 50\)/u);

  assert.match(bulkSource, /export const BULK_UPLOAD_CHUNK_SIZE = 20;/u);

  assert.match(bulkSource, /const MAX_FILE_SIZE = 15 \* 1024 \* 1024;/u);

  assert.match(bulkSource, /multer\.diskStorage\(/u);

  assert.match(bulkSource, /files:\s*BULK_UPLOAD_CHUNK_SIZE/u);
});

test('Multer memoryStorage preserves uploaded buffers', async () => {
  const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: 1024,
      files: 2,
    },
  });

  const app = await startApp(server => {
    server.post('/memory', upload.array('files', 2), (req, res) => {
      res.json({
        files: req.files.map(file => ({
          fieldname: file.fieldname,
          originalname: file.originalname,
          size: file.size,
          content: file.buffer.toString('utf8'),
        })),
      });
    });
  });

  try {
    const form = new FormData();

    form.append(
      'files',
      new Blob(['hello-multer'], {
        type: 'text/plain',
      }),
      'example.txt',
    );

    const response = await fetch(`${app.baseUrl}/memory`, {
      method: 'POST',
      body: form,
    });

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.files.length, 1);

    assert.equal(body.files[0].fieldname, 'files');

    assert.equal(body.files[0].originalname, 'example.txt');

    assert.equal(body.files[0].content, 'hello-multer');
  } finally {
    await app.close();
  }
});

test('Multer memoryStorage still enforces file size limits', async () => {
  const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: 8,
    },
  });

  const app = await startApp(server => {
    server.post('/limit', (req, res) => {
      upload.single('file')(req, res, error => {
        if (!error) {
          return res.json({
            ok: true,
          });
        }

        return res.status(413).json({
          code: error.code ?? null,
        });
      });
    });
  });

  try {
    const form = new FormData();

    form.append(
      'file',
      new Blob(['0123456789abcdef'], {
        type: 'text/plain',
      }),
      'oversized.txt',
    );

    const response = await fetch(`${app.baseUrl}/limit`, {
      method: 'POST',
      body: form,
    });

    assert.equal(response.status, 413);

    const body = await response.json();

    assert.equal(body.code, 'LIMIT_FILE_SIZE');
  } finally {
    await app.close();
  }
});

test('Multer diskStorage writes and reports uploaded files correctly', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-multer-disk-'));

  const storage = multer.diskStorage({
    destination(req, file, callback) {
      callback(null, directory);
    },

    filename(req, file, callback) {
      callback(null, 'stored.txt');
    },
  });

  const upload = multer({
    storage,

    limits: {
      fileSize: 1024,
      files: 2,
    },
  });

  const app = await startApp(server => {
    server.post('/disk', upload.array('files', 2), (req, res) => {
      res.json({
        files: req.files.map(file => ({
          originalname: file.originalname,

          filename: file.filename,

          size: file.size,
        })),
      });
    });
  });

  try {
    const form = new FormData();

    form.append(
      'files',
      new Blob(['disk-content'], {
        type: 'text/plain',
      }),
      'source.txt',
    );

    const response = await fetch(`${app.baseUrl}/disk`, {
      method: 'POST',
      body: form,
    });

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.files.length, 1);

    assert.equal(body.files[0].originalname, 'source.txt');

    assert.equal(body.files[0].filename, 'stored.txt');

    assert.equal(fs.readFileSync(path.join(directory, 'stored.txt'), 'utf8'), 'disk-content');
  } finally {
    await app.close();

    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});
