import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USAGE_PATH = path.join(__dirname, '..', 'data', 'generationUsage.jsonl');

/*
 * Актуальные синхронные тарифы Yandex AI Studio,
 * рублей за 1000 токенов, включая НДС.
 *
 * Цена сохраняется непосредственно в событии,
 * поэтому будущая смена тарифа не изменит
 * стоимость старых генераций.
 */

const VALID_USAGE_SOURCES = new Set(['generation', 'schedule', 'repair', 'import']);

const generationSourceById = new Map();

function resolveUsageSource(source, profession = '') {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();

  if (VALID_USAGE_SOURCES.has(normalized)) {
    return normalized;
  }

  /*
   * Старые repair-записи могли сохранить
   * системный prompt вместо профессии.
   */
  const text = String(profession || '');

  if (
    text.includes('Ты являешься редактором') ||
    text.includes('Текущий документ:') ||
    text.includes('Верни только JSON')
  ) {
    return 'repair';
  }

  return 'generation';
}

const MODEL_PRICES = {
  'yandexgpt/latest': {
    input: 1.2,
    output: 1.2,
  },

  'yandexgpt-5-pro': {
    input: 1.2,
    output: 1.2,
  },

  'yandexgpt/rc': {
    input: 0.8,
    output: 0.8,
  },

  'yandexgpt-5.1': {
    input: 0.8,
    output: 0.8,
  },

  'yandexgpt-lite': {
    input: 0.2,
    output: 0.2,
  },
};

function numberValue(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getModelPrice(model) {
  const envInput = Number(process.env.YANDEX_GPT_INPUT_PRICE_PER_1K_RUB);

  const envOutput = Number(process.env.YANDEX_GPT_OUTPUT_PRICE_PER_1K_RUB);

  if (Number.isFinite(envInput) && Number.isFinite(envOutput) && envInput >= 0 && envOutput >= 0) {
    return {
      input: envInput,
      output: envOutput,
    };
  }

  return (
    MODEL_PRICES[model] || {
      input: 0,
      output: 0,
    }
  );
}

function appendEvent(event) {
  try {
    fs.mkdirSync(path.dirname(USAGE_PATH), {
      recursive: true,
    });

    fs.appendFileSync(USAGE_PATH, JSON.stringify(event) + '\n', 'utf-8');
  } catch (error) {
    /*
     * Ошибка статистики не должна ломать
     * саму генерацию инструкции.
     */
    console.error('[GenerationUsage] Не удалось записать статистику:', error.message);
  }
}

export function createGenerationUsageId(source = 'generation') {
  const id = nanoid();

  generationSourceById.set(id, resolveUsageSource(source));

  return id;
}

export function recordGenerationUsageCall({
  generationId,
  profession,
  source,
  model,
  sectionNumber,
  attempt = 1,
  usage,
}) {
  if (!generationId) {
    return null;
  }

  const inputTokens = numberValue(usage?.inputTextTokens);

  const outputTokens = numberValue(usage?.completionTokens);

  const totalTokens = numberValue(usage?.totalTokens) || inputTokens + outputTokens;

  const price = getModelPrice(model);

  const costRub = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;

  const event = {
    id: nanoid(),

    generationId,

    profession: String(profession || '').trim(),

    source: resolveUsageSource(source || generationSourceById.get(generationId), profession),

    model: String(model || '').trim(),

    sectionNumber: Number(sectionNumber) || null,

    attempt: Number(attempt) || 1,

    inputTokens,

    outputTokens,

    totalTokens,

    inputPricePer1000Rub: price.input,

    outputPricePer1000Rub: price.output,

    costRub: Number(costRub.toFixed(6)),

    createdAt: new Date().toISOString(),
  };

  appendEvent(event);

  return event;
}

function loadEvents() {
  if (!fs.existsSync(USAGE_PATH)) {
    return [];
  }

  try {
    const content = fs.readFileSync(USAGE_PATH, 'utf-8');

    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error('[GenerationUsage] Не удалось прочитать статистику:', error.message);

    return [];
  }
}

function groupGenerations(events) {
  const map = new Map();

  for (const event of events) {
    const id = event.generationId;

    if (!id) {
      continue;
    }

    let item = map.get(id);

    if (!item) {
      item = {
        id,

        profession: event.profession || '',

        model: event.model || '',

        source: resolveUsageSource(event.source, event.profession),

        apiCalls: 0,

        inputTokens: 0,

        outputTokens: 0,

        totalTokens: 0,

        costRub: 0,

        startedAt: event.createdAt,

        finishedAt: event.createdAt,
      };

      map.set(id, item);
    }

    item.apiCalls += 1;

    item.inputTokens += numberValue(event.inputTokens);

    item.outputTokens += numberValue(event.outputTokens);

    item.totalTokens += numberValue(event.totalTokens);

    item.costRub += numberValue(event.costRub);

    if (event.createdAt < item.startedAt) {
      item.startedAt = event.createdAt;
    }

    if (event.createdAt > item.finishedAt) {
      item.finishedAt = event.createdAt;
    }
  }

  return [...map.values()]
    .map(item => ({
      ...item,

      costRub: Number(item.costRub.toFixed(2)),
    }))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function isToday(iso) {
  const date = new Date(iso);

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isCurrentMonth(iso) {
  const date = new Date(iso);

  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function summarize(generations) {
  /*
   * В количество генераций входят только
   * обычная и плановая генерации.
   *
   * import/repair учитываются в расходах,
   * но не увеличивают счётчик генераций.
   */
  const generatedInstructions = generations.filter(
    item => item.source === 'generation' || item.source === 'schedule',
  );

  const result = {
    generations: generatedInstructions.length,

    operations: generations.length,

    apiCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costRub: 0,
    averageCostRub: 0,
  };

  let generationCostRub = 0;

  for (const item of generations) {
    result.apiCalls += item.apiCalls;

    result.inputTokens += item.inputTokens;

    result.outputTokens += item.outputTokens;

    result.totalTokens += item.totalTokens;

    result.costRub += item.costRub;

    if (item.source === 'generation' || item.source === 'schedule') {
      generationCostRub += item.costRub;
    }
  }

  result.costRub = Number(result.costRub.toFixed(2));

  result.averageCostRub = result.generations
    ? Number((generationCostRub / result.generations).toFixed(2))
    : 0;

  return result;
}

export function getGenerationStats() {
  const events = loadEvents();

  const generations = groupGenerations(events);

  const today = generations.filter(item => isToday(item.startedAt));

  const month = generations.filter(item => isCurrentMonth(item.startedAt));

  return {
    today: summarize(today),

    month: summarize(month),

    total: summarize(generations),

    recent: generations.slice(0, 20),

    trackingStarted: events.length ? events[0].createdAt : null,
  };
}
