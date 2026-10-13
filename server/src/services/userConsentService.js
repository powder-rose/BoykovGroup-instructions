import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');

const CONSENTS_FILE = path.join(DATA_DIR, 'registration-consents.json');

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });

  if (!fs.existsSync(CONSENTS_FILE)) {
    fs.writeFileSync(CONSENTS_FILE, '[]\n', {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
}

function readRecords() {
  ensureStorage();

  const raw = fs.readFileSync(CONSENTS_FILE, 'utf8');

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('registration-consents.json must contain an array');
  }

  return parsed;
}

function writeRecords(records) {
  ensureStorage();

  const temporaryFile = `${CONSENTS_FILE}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(temporaryFile, `${JSON.stringify(records, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });

  fs.renameSync(temporaryFile, CONSENTS_FILE);
}

export function recordRegistrationConsents({
  userId,
  email,
  userAgreementAccepted,
  personalDataConsentAccepted,
  advertisingConsentAccepted,
}) {
  const records = readRecords();

  const now = new Date().toISOString();

  records.push({
    userId: userId ?? null,

    email: String(email ?? '')
      .trim()
      .toLowerCase(),

    recordedAt: now,

    userAgreement: {
      document: 'Пользовательское соглашение',

      accepted: userAgreementAccepted === true,

      acceptedAt: userAgreementAccepted === true ? now : null,
    },

    personalDataConsent: {
      document: 'Согласие на обработку персональных данных',

      accepted: personalDataConsentAccepted === true,

      acceptedAt: personalDataConsentAccepted === true ? now : null,
    },

    advertisingConsent: {
      document: 'Согласие на получение рекламных и информационных сообщений',

      accepted: advertisingConsentAccepted === true,

      acceptedAt: advertisingConsentAccepted === true ? now : null,
    },
  });

  writeRecords(records);

  return true;
}
