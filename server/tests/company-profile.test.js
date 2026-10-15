import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { EMPTY_COMPANY_PROFILE, normalizeCompanyProfile } from '../src/shared/companyProfile.js';
import { createCompanyProfileRepository } from '../src/services/companyProfileRepository.js';
import {
  createCompanyProfileNotificationWorker,
  formatCompanyProfileNotification,
} from '../src/services/companyProfileNotificationService.js';

const user = {
  id: 'user-a',
  name: 'Пользователь',
  email: 'test@example.com',
  phone: '+70000000000',
};
const logger = { warn() {}, error() {} };

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-company-profile-'));
  const file = path.join(directory, 'company-profiles.json');
  let timestamp = Date.parse('2026-10-15T09:00:00Z');
  const now = () => timestamp;
  const repository = createCompanyProfileRepository({ file, now });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    file,
    repository,
    now,
    advance(milliseconds) {
      timestamp += milliseconds;
    },
    state: () => JSON.parse(fs.readFileSync(file, 'utf8')),
  };
}

test('company profile normalizes only five optional fields and validates all data before saving', () => {
  assert.deepEqual(normalizeCompanyProfile({}), EMPTY_COMPANY_PROFILE);
  assert.deepEqual(normalizeCompanyProfile({ companyName: ' ООО  «Тест» ', ignored: 'secret' }), {
    ...EMPTY_COMPANY_PROFILE,
    companyName: 'ООО «Тест»',
  });
  for (const inn of ['1234567890', '123456789012', '']) {
    assert.equal(normalizeCompanyProfile({ inn }).inn, inn);
  }
  for (const input of [
    null,
    [],
    1,
    { inn: '1234' },
    { inn: '123456789a' },
    { companyName: 42 },
    { occupationalSafetyPosition: {} },
    { headFullName: null },
    { companyName: 'a'.repeat(301) },
    { occupationalSafetyPosition: 'a'.repeat(201) },
    { companyName: 'bad\nheader' },
    { companyName: 'bad\u0000header' },
    { headFullName: 'bad\u202ename' },
  ]) {
    assert.throws(() => normalizeCompanyProfile(input), { code: 'VALIDATION_ERROR' });
  }
});

test('profiles survive restart, isolate users and atomically enqueue only meaningful changes', t => {
  const { repository, file, advance, state, now } = fixture(t);
  assert.equal(repository.getView(user.id).updatedAt, null);
  assert.equal(fs.existsSync(file), false);

  const first = repository.save(user, { companyName: ' ООО  «Тест» ', inn: '1234567890' });
  assert.equal(first.companyProfile.companyName, 'ООО «Тест»');
  assert.equal(state().outbox.length, 1);
  // Windows does not expose POSIX owner/group permission bits.
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
  advance(5000);
  assert.deepEqual(repository.save(user, first.companyProfile), first);
  assert.equal(state().outbox.length, 1);

  const restarted = createCompanyProfileRepository({ file, now });
  assert.deepEqual(restarted.getView(user.id), first);
  assert.deepEqual(restarted.getView('user-b').companyProfile, EMPTY_COMPANY_PROFILE);
  restarted.save({ ...user, id: 'user-b' }, { companyName: 'Вторая компания' });
  assert.deepEqual(repository.getView(user.id), first);
  repository.save(user, {});
  assert.deepEqual(repository.getView(user.id).companyProfile, EMPTY_COMPANY_PROFILE);
  assert.equal(state().outbox.length, 3);
  assert.deepEqual(state().outbox[2].companyProfile, EMPTY_COMPANY_PROFILE);
});

test('legacy head position is omitted without changing other details or queuing another email', t => {
  const { repository, file, state, now } = fixture(t);
  const saved = repository.save(user, {
    companyName: 'ООО «Тест»',
    headFullName: 'Петров Пётр Петрович',
  });
  const legacy = state();
  legacy.profiles[user.id].companyProfile.headPosition = 'LEGACY_HEAD_POSITION';
  legacy.outbox[0].companyProfile.headPosition = 'LEGACY_HEAD_POSITION';
  fs.writeFileSync(file, JSON.stringify(legacy));

  const restarted = createCompanyProfileRepository({ file, now });
  assert.deepEqual(restarted.getView(user.id), saved);
  assert.deepEqual(restarted.dismiss(user.id), saved);
  assert.deepEqual(
    restarted.save(user, { ...saved.companyProfile, headPosition: 'IGNORED_OLD_FORM_VALUE' }),
    saved,
  );
  assert.equal(state().outbox.length, 1);

  const notification = formatCompanyProfileNotification(restarted.getPending()[0]);
  assert.doesNotMatch(notification.text, /LEGACY_HEAD_POSITION|Должность руководителя/u);
  assert.doesNotMatch(notification.html, /LEGACY_HEAD_POSITION|Должность руководителя/u);
  assert.ok(notification.text.includes(saved.companyProfile.headFullName));
});

test('blank initial save and dismiss complete onboarding without sending mail or changing data', t => {
  const { repository, state, advance } = fixture(t);
  const blank = repository.save(user, {});
  assert.ok(blank.onboardingCompletedAt);
  assert.equal(blank.updatedAt, null);
  assert.equal(state().outbox.length, 0);
  advance(10_000);
  assert.deepEqual(repository.dismiss(user.id), blank);
  assert.deepEqual(repository.save(user, {}), blank);

  const saved = repository.save(user, { headFullName: 'Петров Пётр Петрович' });
  advance(10_000);
  assert.deepEqual(repository.dismiss(user.id), saved);
  assert.equal(state().outbox.length, 1);
});

test('invalid input and corrupt storage do not replace saved profiles', t => {
  const { repository, file } = fixture(t);
  repository.save(user, { companyName: 'Сохранено' });
  const original = fs.readFileSync(file, 'utf8');
  assert.throws(() => repository.save(user, { inn: 'bad' }), { code: 'VALIDATION_ERROR' });
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => repository.save(user, { companyName: 'Нельзя перезаписать' }));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('failed email remains durable and retries after backoff and worker restart', async t => {
  const { repository, file, now, advance, state } = fixture(t);
  repository.save(user, { companyName: 'Сохранено при сбое SMTP' });
  let attempts = 0;
  const worker = createCompanyProfileNotificationWorker({
    repository,
    logger,
    send: async () => {
      attempts += 1;
      throw new Error('SMTP unavailable');
    },
  });
  worker.start();
  await worker.flush();
  await worker.stop();
  assert.equal(attempts, 1);
  assert.equal(state().outbox.length, 1);
  assert.equal(state().outbox[0].attempts, 1);
  assert.equal(repository.getPending().length, 0);
  assert.equal(repository.getView(user.id).companyProfile.companyName, 'Сохранено при сбое SMTP');

  advance(60_000);
  const restarted = createCompanyProfileRepository({ file, now });
  const delivered = [];
  const resumed = createCompanyProfileNotificationWorker({
    repository: restarted,
    logger,
    send: async event => delivered.push(event),
  });
  resumed.start();
  await resumed.flush();
  await resumed.stop();
  assert.equal(delivered.length, 1);
  assert.equal(state().outbox.length, 0);
});

test('email acknowledgement preserves a newer profile and notification saved during delivery', async t => {
  const { repository, state } = fixture(t);
  repository.save(user, { companyName: 'Первое сохранение' });
  let release;
  const delivered = [];
  const worker = createCompanyProfileNotificationWorker({
    repository,
    logger,
    send: event => {
      delivered.push(event);
      return new Promise(resolve => {
        release = resolve;
      });
    },
  });
  worker.start();
  const sending = worker.flush();
  assert.equal(delivered.length, 1);
  repository.save(user, { companyName: 'Второе сохранение' });
  assert.equal(worker.flush(), sending, 'parallel flushes share one SMTP operation');
  release();
  await sending;
  await worker.stop();
  assert.equal(repository.getView(user.id).companyProfile.companyName, 'Второе сохранение');
  assert.equal(state().outbox.length, 1);
  assert.equal(state().outbox[0].companyProfile.companyName, 'Второе сохранение');
});

test('worker shutdown waits for the current email and leaves remaining events for restart', async t => {
  const { repository, state } = fixture(t);
  repository.save(user, { companyName: 'Первая' });
  repository.save({ ...user, id: 'user-b' }, { companyName: 'Вторая' });
  let release;
  let sends = 0;
  const worker = createCompanyProfileNotificationWorker({
    repository,
    logger,
    send: () => {
      sends += 1;
      return new Promise(resolve => {
        release = resolve;
      });
    },
  });
  worker.start();
  const sending = worker.flush();
  const stopping = worker.stop();
  release();
  await Promise.all([sending, stopping]);
  assert.equal(sends, 1);
  assert.equal(state().outbox.length, 1);
});

test('staff email includes all fields and account identity with safe HTML and stable message ID', () => {
  const event = {
    id: 'event-id',
    createdAt: '2026-10-15T09:00:00Z',
    user: { ...user, name: '<img src=x onerror=alert(1)>' },
    companyProfile: { ...EMPTY_COMPANY_PROFILE, companyName: 'ООО «А & Б»', inn: '1234567890' },
  };
  const notification = formatCompanyProfileNotification(event);
  assert.match(notification.text, /Email пользователя: test@example.com/);
  assert.match(notification.text, /ФИО ответственного по охране труда: Не заполнено/);
  assert.match(notification.text, /12:00:00/);
  assert.match(notification.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(notification.html, /А &amp; Б/);
  assert.ok(!notification.html.includes('<img'));
  assert.equal(notification.messageId, '<company-profile-event-id@boykovdocs.ru>');
});
