import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { EMPTY_COMPANY_PROFILE, normalizeCompanyProfile } from '../shared/companyProfile.js';

const DEFAULT_FILE = fileURLToPath(new URL('../../data/company-profiles.json', import.meta.url));

function profileView(record) {
  return {
    companyProfile: Object.fromEntries(
      Object.keys(EMPTY_COMPANY_PROFILE).map(name => [name, record?.companyProfile?.[name] ?? '']),
    ),
    updatedAt: record?.updatedAt ?? null,
    onboardingCompletedAt: record?.onboardingCompletedAt ?? null,
  };
}

export function createCompanyProfileRepository({ file = DEFAULT_FILE, now = Date.now } = {}) {
  function read() {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, profiles: {}, outbox: [] };
      throw error;
    }
    const state = JSON.parse(raw);
    if (
      state.version !== 1 ||
      !state.profiles ||
      typeof state.profiles !== 'object' ||
      Array.isArray(state.profiles) ||
      !Array.isArray(state.outbox)
    ) {
      throw new Error('Invalid company profile storage');
    }
    return state;
  }

  function write(state) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const descriptor = fs.openSync(temporaryFile, 'wx', 0o600);
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fs.renameSync(temporaryFile, file);
    } finally {
      fs.rmSync(temporaryFile, { force: true });
    }
  }

  function getRecord(state, userId) {
    return Object.hasOwn(state.profiles, userId) ? state.profiles[userId] : undefined;
  }

  return {
    getView(userId) {
      return profileView(getRecord(read(), userId));
    },

    save(user, input) {
      const companyProfile = normalizeCompanyProfile(input);
      const state = read();
      const previous = profileView(getRecord(state, user.id));
      const changed = Object.keys(EMPTY_COMPANY_PROFILE).some(
        field => companyProfile[field] !== previous.companyProfile[field],
      );
      const timestamp = new Date(now()).toISOString();
      const view = {
        companyProfile,
        updatedAt: changed ? timestamp : previous.updatedAt,
        onboardingCompletedAt: previous.onboardingCompletedAt ?? timestamp,
      };

      // One atomic replacement commits both profile and its notification snapshot.
      state.profiles = { ...state.profiles, [user.id]: view };
      if (changed) {
        state.outbox.push({
          id: randomUUID(),
          user: {
            id: user.id,
            name: user.name ?? '',
            email: user.email ?? '',
            phone: user.phone ?? '',
          },
          companyProfile,
          createdAt: timestamp,
          attempts: 0,
          nextAttemptAt: timestamp,
        });
      }
      if (changed || !previous.onboardingCompletedAt) write(state);
      return profileView(view);
    },

    dismiss(userId) {
      const state = read();
      const view = profileView(getRecord(state, userId));
      if (!view.onboardingCompletedAt) {
        view.onboardingCompletedAt = new Date(now()).toISOString();
        state.profiles = { ...state.profiles, [userId]: view };
        write(state);
      }
      return view;
    },

    getPending(limit = 3) {
      const seenUsers = new Set();
      return read()
        .outbox.filter(item => {
          // Preserve each account's update order even when an earlier email is retrying.
          if (seenUsers.has(item.user.id)) return false;
          seenUsers.add(item.user.id);
          return Date.parse(item.nextAttemptAt) <= now();
        })
        .slice(0, limit);
    },

    acknowledge(eventId) {
      const state = read();
      const remaining = state.outbox.filter(item => item.id !== eventId);
      if (remaining.length !== state.outbox.length) write({ ...state, outbox: remaining });
    },

    retry(eventId) {
      const state = read();
      const event = state.outbox.find(item => item.id === eventId);
      if (!event) return;
      event.attempts += 1;
      const delay = Math.min(60_000 * 2 ** Math.min(event.attempts - 1, 10), 3_600_000);
      event.nextAttemptAt = new Date(now() + delay).toISOString();
      write(state);
    },
  };
}
