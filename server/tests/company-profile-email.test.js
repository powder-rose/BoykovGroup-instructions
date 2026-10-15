import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import test from 'node:test';

import { sendSystemEmail } from '../src/services/emailVerificationService.js';

test('company notification deadline closes a stalled local SMTP socket before shutdown', async t => {
  const sockets = new Set();
  let accepted = false;
  const server = net.createServer(socket => {
    accepted = true;
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    // No SMTP greeting: simulate an unavailable server without delivering any mail.
    socket.resume();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const environment = {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(server.address().port),
    SMTP_SECURE: 'false',
    SMTP_USER: 'local-test',
    SMTP_PASS: 'local-test',
    SMTP_FROM: 'local-test@example.invalid',
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  });

  const startedAt = Date.now();
  await assert.rejects(
    sendSystemEmail({
      to: 'local-test@example.invalid',
      subject: 'Local timeout test',
      timeoutMs: 150,
    }),
    error => error.code === 'EMAIL_TIMEOUT' || error.code === 'ETIMEDOUT',
  );
  assert.ok(Date.now() - startedAt < 1500);
  assert.equal(accepted, true);
  if (sockets.size) await Promise.all([...sockets].map(socket => once(socket, 'close')));
  assert.equal(sockets.size, 0);
});
