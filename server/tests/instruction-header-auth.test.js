import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('instruction header reuses the shared authentication control', () => {
  const header = read(
    '../../client/src/components/InstructionStickyHeader/InstructionStickyHeader.jsx',
  );

  assert.match(header, /import AuthControl from/u);
  assert.match(
    header,
    /<div className=\{styles\.logo\}>\s*<AuthControl compact \/>\s*<SiteLinkButton \/>/u,
  );

  assert.doesNotMatch(header, /WalletBalanceBadge/u);
  assert.match(header, /<HeroPortrait compact \/>/u);
  assert.match(header, /<Navigation \/>/u);
});

test('instruction authentication preserves the existing login modal', () => {
  const auth = read('../../client/src/components/AuthControl/AuthControl.jsx');

  assert.match(auth, /<AuthUserMenu/u);
  assert.match(auth, /<WalletBalanceBadge \/>/u);
  assert.match(auth, /войти \/ регистрация/u);
  assert.match(auth, /createPortal\([\s\S]*?document\.body/u);
});

test('instruction authentication remains available on smaller screens', () => {
  const css = read(
    '../../client/src/components/InstructionStickyHeader/InstructionStickyHeader.module.css',
  );

  assert.match(css, /\.logo\s*\{[^}]*gap:\s*12px;/su);
  assert.match(css, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.logo\s*\{\s*display:\s*flex;/u);
  assert.match(css, /\.logo > a\s*\{\s*display:\s*none;/u);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1024px\)/u);
});
