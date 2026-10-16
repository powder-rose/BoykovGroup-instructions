import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const eslint = new ESLint({
  cwd: projectRoot,
});

const nodeGlobals = `
export const environmentGlobals = [
  process, Buffer, console, setTimeout, fetch,
  FormData, Headers, Request, Response, URL, URLSearchParams,
];
`;

const browserGlobals = `
export const environmentGlobals = [window, document, navigator, console, fetch, URL];
`;

const cases = [
  ['server/src/eslint-probe.js', nodeGlobals],
  ['server/tests/eslint-probe.test.js', nodeGlobals],
  ['server/scripts/eslint-probe.js', nodeGlobals],
  ['scripts/eslint-probe.mjs', nodeGlobals],
  ['client/vite.config.js', nodeGlobals],
  ['eslint.config.mjs', nodeGlobals],
  ['client/src/eslint-probe.js', browserGlobals],
  ['client/src/eslint-probe.jsx', browserGlobals],
  ['client/public/assets/company-profile-probe.js', browserGlobals],
  ['client/public/assets/wallet-probe.js', browserGlobals],
];

for (const [relativePath, validSource] of cases) {
  test(`recommended rules and environment globals apply to ${relativePath}`, async () => {
    const filePath = path.join(projectRoot, relativePath);
    const [invalidResult] = await eslint.lintText(
      'export const value = { key: 1, key: 2 }; missingAuditIdentifier();',
      { filePath },
    );

    assert.equal(invalidResult.fatalErrorCount, 0);

    for (const ruleId of ['no-undef', 'no-dupe-keys']) {
      assert.ok(
        invalidResult.messages.some(message => message.ruleId === ruleId && message.severity === 2),
        `${relativePath} must report ${ruleId} as an error`,
      );
    }

    const [validResult] = await eslint.lintText(validSource, { filePath });

    assert.deepEqual(validResult.messages, []);
  });
}
