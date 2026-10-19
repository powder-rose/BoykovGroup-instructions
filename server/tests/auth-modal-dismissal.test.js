import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('login and registration do not close on backdrop or Escape', () => {
  const modal = read('../../client/src/components/LoginModal/LoginModal.jsx');
  const hook = read('../../client/src/components/LoginModal/hooks/useLoginModal.js');

  assert.match(modal, /<div className=\{styles\.overlay\}>/u);
  assert.match(modal, /className=\{styles\.close\} onClick=\{onClose\}/u);
  assert.doesNotMatch(hook, /event\.key === 'Escape'/u);
  assert.match(hook, /if \(ok\) \{\s*onClose\(\);/u);
});

test('PDF registration closes only explicitly or after success', () => {
  const modal = read('../../client/src/components/PdfRegistrationModal/PdfRegistrationModal.jsx');
  const hook = read(
    '../../client/src/components/PdfRegistrationModal/hooks/usePdfRegistrationModal.js',
  );

  assert.doesNotMatch(modal, /onMouseDown=\{handleOverlayClick\}/u);
  assert.match(modal, /className="boykovPdfRegistration__close"[\s\S]*?onClick=\{closeModal\}/u);
  assert.doesNotMatch(hook, /handleOverlayClick|event\.key === 'Escape'/u);
  assert.match(hook, /onCloseRef\.current\?\.\(\)/u);
});
