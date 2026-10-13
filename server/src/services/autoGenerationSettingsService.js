import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'autoGenerationSettings.json');

const DEFAULT_SETTINGS = {
  enabled: true,
};

function ensureSettingsFile() {
  if (fs.existsSync(SETTINGS_PATH)) {
    return;
  }

  fs.mkdirSync(path.dirname(SETTINGS_PATH), {
    recursive: true,
  });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n', 'utf8');
}

export function getAutoGenerationSettings() {
  ensureSettingsFile();

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');

    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));

    return {
      enabled: parsed?.enabled !== false,
    };
  } catch (error) {
    console.error('Не удалось прочитать настройки автогенерации:', error.message);

    return {
      ...DEFAULT_SETTINGS,
    };
  }
}

export function isAutoGenerationEnabled() {
  return getAutoGenerationSettings().enabled;
}

export function setAutoGenerationEnabled(enabled) {
  const settings = {
    enabled: Boolean(enabled),
  };

  fs.mkdirSync(path.dirname(SETTINGS_PATH), {
    recursive: true,
  });

  /*
   * Сначала пишем во временный файл,
   * затем атомарно заменяем основной.
   */
  const tempPath = SETTINGS_PATH + '.tmp';

  fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  fs.renameSync(tempPath, SETTINGS_PATH);

  return settings;
}
