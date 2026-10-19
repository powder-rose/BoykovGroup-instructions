import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('fixed compact header mounts the shared auth control only when visible', () => {
  const header = read(
    '../../client/src/pages/HomePage/components/HomeCompactHeader/HomeCompactHeader.jsx',
  );
  const controls = read(
    '../../client/src/pages/HomePage/components/HomeHeaderControls/HomeHeaderControls.jsx',
  );
  assert.match(header, /showAuth=\{visible\}/u);
  assert.match(controls, /showAuth \? <AuthControl compact \/> : <WalletBalanceBadge \/>/u);
});

test('login modal renders in the document body, outside the transformed fixed header', () => {
  const auth = read('../../client/src/components/AuthControl/AuthControl.jsx');
  assert.match(auth, /createPortal\(\s*<LoginModal[\s\S]*?document\.body[\s,]*\)/u);
});

test('small-screen compact header keeps accessible auth controls', () => {
  const css = read('../../client/src/App.module.css');
  assert.match(
    css,
    /\.safeCompactHeader \.stickyIntroCompact \.compactControls\s*\{[^}]*overflow:\s*visible/su,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.safeCompactHeader \.compactLogo > a\s*\{\s*display:\s*none/su,
  );
});
