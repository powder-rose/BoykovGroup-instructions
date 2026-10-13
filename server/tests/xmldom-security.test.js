import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

import { extractTextFromUpload } from '../src/services/documentTextExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function createMinimalDocx() {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override
          PartName="/word/document.xml"
          ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
        />
      </Types>`,
  );

  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship
          Id="rId1"
          Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
          Target="word/document.xml"
        />
      </Relationships>`,
  );

  zip.folder('word').file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document
        xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      >
        <w:body>
          <w:p>
            <w:r>
              <w:t>Тестовая инструкция</w:t>
            </w:r>
          </w:p>

          <w:p>
            <w:r>
              <w:t>1. ОБЩИЕ ТРЕБОВАНИЯ ОХРАНЫ ТРУДА</w:t>
            </w:r>
          </w:p>

          <w:p>
            <w:r>
              <w:t>1.1. Проверочный пункт.</w:t>
            </w:r>
          </w:p>

          <w:sectPr/>
        </w:body>
      </w:document>`,
  );

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

test('@xmldom/xmldom security baseline is 0.8.15', () => {
  const packageJson = readJson(
    path.join(serverRoot, 'node_modules', '@xmldom', 'xmldom', 'package.json'),
  );

  assert.equal(packageJson.version, '0.8.15', 'BoykovDocs must use patched @xmldom/xmldom 0.8.15');
});

test('DOCX extraction still works through Mammoth and documentTextExtractor', async () => {
  const buffer = await createMinimalDocx();

  const text = await extractTextFromUpload({
    buffer,

    originalName: 'security-regression.docx',

    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  assert.match(text, /Тестовая инструкция/u);

  assert.match(text, /1\. ОБЩИЕ ТРЕБОВАНИЯ ОХРАНЫ ТРУДА/u);

  assert.match(text, /1\.1\. Проверочный пункт\./u);
});
