import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repositoryRoot = path.resolve(__dirname, '../..');

const authServiceUrl = pathToFileURL(
  path.join(repositoryRoot, 'server', 'src', 'services', 'authService.js'),
).href;

const serverEntrypoint = path.join(repositoryRoot, 'server', 'src', 'index.js');

function buildEnvironment(jwtSecret) {
  const env = {
    ...process.env,

    /*
     * Never let an unrelated local .env file affect
     * this security regression test.
     */
    DOTENV_CONFIG_PATH: path.join(repositoryRoot, 'server', 'tests', '__missing-security-test.env'),
  };

  delete env.JWT_SECRET;

  if (jwtSecret !== undefined) {
    env.JWT_SECRET = jwtSecret;
  }

  return env;
}

function runAuthProbe(jwtSecret) {
  const script = `
    import {
      issueAdminToken,
      verifyToken,
    } from ${JSON.stringify(authServiceUrl)};

    try {
      const token = issueAdminToken();

      const payload = verifyToken(token);

      process.stdout.write(
        JSON.stringify({
          ok: true,
          role: payload.role,
        }),
      );
    } catch (error) {
      process.stderr.write(
        [
          String(error?.code ?? ''),
          String(error?.message ?? error),
        ].join(':'),
      );

      process.exitCode = 23;
    }
  `;

  return spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: repositoryRoot,
    env: buildEnvironment(jwtSecret),
    encoding: 'utf8',
    timeout: 5000,
  });
}

test('JWT signing fails closed when JWT_SECRET is missing', () => {
  const result = runAuthProbe(undefined);

  assert.equal(
    result.status,
    23,
    `JWT must not be issued without JWT_SECRET. stdout=${result.stdout} stderr=${result.stderr}`,
  );

  assert.match(result.stderr, /JWT_SECRET/u);
});

test('JWT signing rejects the historical insecure fallback secret', () => {
  const result = runAuthProbe('dev-insecure-secret-change-me');

  assert.equal(
    result.status,
    23,
    `Known insecure JWT secret must be rejected. stdout=${result.stdout} stderr=${result.stderr}`,
  );

  assert.match(result.stderr, /JWT_SECRET/u);
});

test('JWT signing rejects the documented placeholder secret', () => {
  const result = runAuthProbe('change-me-to-a-long-random-string');

  assert.equal(
    result.status,
    23,
    `Placeholder JWT secret must be rejected. stdout=${result.stdout} stderr=${result.stderr}`,
  );

  assert.match(result.stderr, /JWT_SECRET/u);
});

test('JWT signing rejects secrets shorter than 32 bytes', () => {
  const result = runAuthProbe('too-short-secret');

  assert.equal(
    result.status,
    23,
    `Short JWT secret must be rejected. stdout=${result.stdout} stderr=${result.stderr}`,
  );

  assert.match(result.stderr, /JWT_SECRET/u);
});

test('JWT signing and verification work with a strong secret', () => {
  const result = runAuthProbe('boykovdocs-test-only-jwt-secret-with-more-than-32-bytes');

  assert.equal(result.status, 0, `Strong JWT secret should work. stderr=${result.stderr}`);

  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.role, 'admin');
});

test('server entrypoint refuses to listen without JWT_SECRET', () => {
  const result = spawnSync(process.execPath, [serverEntrypoint], {
    cwd: repositoryRoot,
    env: {
      ...buildEnvironment(undefined),
      PORT: '0',
    },
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(
    result.status,
    1,
    `Server must exit before listening without JWT_SECRET. stdout=${result.stdout} stderr=${result.stderr}`,
  );

  const output = `${result.stdout}\n${result.stderr}`;

  assert.match(output, /JWT_SECRET/u);

  assert.doesNotMatch(
    output,
    /Instructions API запущен/u,
    'HTTP server must not start before JWT configuration succeeds',
  );
});
