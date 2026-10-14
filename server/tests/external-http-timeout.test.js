import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

const timeoutUtilityPath = path.join(serverRoot, 'src', 'utils', 'fetchWithTimeout.js');

async function loadTimeoutUtility() {
  return import(pathToFileURL(timeoutUtilityPath).href);
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(serverRoot, relativePath), 'utf8');
}

test('fetchWithTimeout aborts a stalled external request with a stable error code', async () => {
  const { fetchWithTimeout } = await loadTimeoutUtility();

  let observedSignal = null;

  const stalledFetch = async (url, options = {}) => {
    void url;

    observedSignal = options.signal ?? null;

    return new Promise((resolve, reject) => {
      void resolve;

      if (!observedSignal) {
        return;
      }

      const abort = () => {
        const error = new Error('simulated aborted request');

        error.name = 'AbortError';

        reject(error);
      };

      if (observedSignal.aborted) {
        abort();
        return;
      }

      observedSignal.addEventListener('abort', abort, {
        once: true,
      });
    });
  };

  const startedAt = performance.now();

  await assert.rejects(
    () =>
      fetchWithTimeout(
        stalledFetch,
        'https://example.invalid/stalled',
        {
          method: 'POST',
        },
        {
          timeoutMs: 25,

          timeoutCode: 'TEST_HTTP_TIMEOUT',
        },
      ),

    error => {
      assert.equal(error?.name, 'ExternalHttpTimeoutError');

      assert.equal(error?.code, 'TEST_HTTP_TIMEOUT');

      assert.equal(error?.timeoutMs, 25);

      return true;
    },
  );

  const elapsed = performance.now() - startedAt;

  assert.ok(observedSignal, 'fetch implementation must receive an AbortSignal');

  assert.equal(observedSignal.aborted, true);

  assert.ok(elapsed < 500, `timeout took too long: ${elapsed}ms`);
});

const serviceContracts = [
  {
    name: 'CloudPayments',

    path: 'src/services/cloudPaymentsApiService.js',

    env: 'CLOUDPAYMENTS_HTTP_TIMEOUT_MS',
  },
  {
    name: 'YandexGPT generation',

    path: 'src/services/yandexGptService.js',

    env: 'YANDEX_GPT_HTTP_TIMEOUT_MS',
  },
  {
    name: 'YandexGPT moderation',

    path: 'src/services/yandexProfessionModerationService.js',

    env: 'YANDEX_MODERATION_HTTP_TIMEOUT_MS',
  },
];

for (const contract of serviceContracts) {
  test(`${contract.name} external HTTP calls use the timeout wrapper`, () => {
    const source = readSource(contract.path);

    assert.match(source, /fetchWithTimeout/u, `${contract.name} must use fetchWithTimeout`);

    assert.match(
      source,
      new RegExp(contract.env, 'u'),
      `${contract.name} must expose an explicit timeout configuration`,
    );

    /*
     * После hardening в критических
     * integration-service не должно
     * оставаться прямого await fetch(...).
     */
    assert.doesNotMatch(
      source,
      /await\s+fetch\s*\(/u,
      `${contract.name} still has an unbounded direct fetch`,
    );
  });
}
