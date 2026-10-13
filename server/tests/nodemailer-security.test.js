import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sendVerificationEmail } from '../src/services/emailVerificationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function startFakeSmtpServer() {
  const messages = [];
  const commands = [];

  const server = net.createServer(socket => {
    socket.setEncoding('utf8');

    socket.write('220 localhost ESMTP BoykovDocs test server\r\n');

    let buffer = '';
    let mode = 'command';
    let authStep = null;
    let messageLines = [];

    function reply(value) {
      socket.write(value + '\r\n');
    }

    function handleCommand(line) {
      commands.push(line);

      if (authStep === 'username') {
        authStep = 'password';

        reply('334 UGFzc3dvcmQ6');

        return;
      }

      if (authStep === 'password') {
        authStep = null;

        reply('235 2.7.0 Authentication successful');

        return;
      }

      if (/^EHLO\b/iu.test(line)) {
        socket.write(
          ['250-localhost', '250-AUTH PLAIN LOGIN', '250 SIZE 10485760', ''].join('\r\n'),
        );

        return;
      }

      if (/^HELO\b/iu.test(line)) {
        reply('250 localhost');

        return;
      }

      if (/^AUTH PLAIN\b/iu.test(line)) {
        reply('235 2.7.0 Authentication successful');

        return;
      }

      if (/^AUTH LOGIN\b/iu.test(line)) {
        authStep = 'username';

        reply('334 VXNlcm5hbWU6');

        return;
      }

      if (/^MAIL FROM:/iu.test(line)) {
        reply('250 2.1.0 Sender OK');

        return;
      }

      if (/^RCPT TO:/iu.test(line)) {
        reply('250 2.1.5 Recipient OK');

        return;
      }

      if (/^DATA$/iu.test(line)) {
        mode = 'data';

        messageLines = [];

        reply('354 End data with <CR><LF>.<CR><LF>');

        return;
      }

      if (/^RSET$/iu.test(line)) {
        reply('250 2.0.0 Reset');

        return;
      }

      if (/^QUIT$/iu.test(line)) {
        reply('221 2.0.0 Bye');

        socket.end();

        return;
      }

      reply('250 2.0.0 OK');
    }

    function handleLine(line) {
      if (mode === 'data') {
        if (line === '.') {
          messages.push(messageLines.join('\r\n'));

          messageLines = [];

          mode = 'command';

          reply('250 2.0.0 Message accepted');

          return;
        }

        messageLines.push(line);

        return;
      }

      handleCommand(line);
    }

    socket.on('data', chunk => {
      buffer += chunk;

      while (true) {
        const separator = buffer.indexOf('\r\n');

        if (separator < 0) {
          break;
        }

        const line = buffer.slice(0, separator);

        buffer = buffer.slice(separator + 2);

        handleLine(line);
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      resolve({
        port: address.port,

        messages,

        commands,

        async close() {
          if (!server.listening) {
            return;
          }

          await new Promise((closeResolve, closeReject) => {
            server.close(error => {
              if (error) {
                closeReject(error);

                return;
              }

              closeResolve();
            });
          });
        },
      });
    });
  });
}

function preserveEnvironment(keys) {
  const previous = new Map();

  for (const key of keys) {
    previous.set(key, process.env[key]);
  }

  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test('Nodemailer security baseline is pinned to 10.1.0', () => {
  const packageJson = readJson(path.join(serverRoot, 'node_modules', 'nodemailer', 'package.json'));

  assert.equal(
    packageJson.version,
    '10.1.0',
    'BoykovDocs must use the supported Nodemailer 10.1.0 security baseline',
  );
});

test('verification email works through the production SMTP code path', async () => {
  const smtp = await startFakeSmtpServer();

  const restore = preserveEnvironment([
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'PUBLIC_BASE_URL',
  ]);

  try {
    process.env.SMTP_HOST = '127.0.0.1';

    process.env.SMTP_PORT = String(smtp.port);

    process.env.SMTP_SECURE = 'false';

    process.env.SMTP_USER = 'test-user';

    process.env.SMTP_PASS = 'test-password';

    process.env.SMTP_FROM = 'noreply@example.test';

    process.env.PUBLIC_BASE_URL = 'https://boykovdocs.ru';

    const result = await sendVerificationEmail({
      email: 'recipient@example.test',

      token: 'test-token',
    });

    assert.deepEqual(result, {
      ok: true,
    });

    assert.equal(smtp.messages.length, 1, 'exactly one email should be accepted by SMTP');

    const message = smtp.messages[0];

    assert.match(message, /recipient@example\.test/u);

    assert.match(message, /verify-email/u);

    assert.ok(
      smtp.commands.some(command => /^AUTH /iu.test(command)),
      'production transport must authenticate',
    );

    assert.ok(smtp.commands.some(command => /^MAIL FROM:/iu.test(command)));

    assert.ok(smtp.commands.some(command => /^RCPT TO:/iu.test(command)));

    assert.ok(smtp.commands.includes('DATA'));
  } finally {
    restore();

    await smtp.close();
  }
});
