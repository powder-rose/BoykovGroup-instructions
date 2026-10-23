import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, TextDecoder } from 'node:util';

import { readReclassificationInstructions } from './checkInstructionReclassification.js';
import { buildInstructionTaxonomyAcceptanceReport } from '../src/services/instructionTaxonomyAcceptance.js';
import { auditInstructionTaxonomyHttp } from '../src/services/instructionTaxonomyHttpAudit.js';
import { instructionTaxonomyCsvOrigin } from '../src/services/instructionTaxonomyCsvFormat.js';

const SEED_FILE = fileURLToPath(
  new URL('../src/data/instructionTaxonomyCatalog.json', import.meta.url),
);

function readRegistry(file) {
  const absolute = path.resolve(file);
  if (!fs.lstatSync(absolute).isFile()) {
    throw new Error('Registry must be a regular file, not a symbolic link');
  }
  const bytes = fs.readFileSync(absolute);
  return {
    registry: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    file: fs.realpathSync(absolute),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function readSnapshot(directory) {
  const snapshot = readReclassificationInstructions(directory);
  for (const [index, instruction] of snapshot.instructions.entries()) {
    if (snapshot.fingerprints[index].file !== `${instruction.id}.json`) {
      throw new Error('Instruction filename must match its ID');
    }
  }
  return snapshot;
}

function isWithin(directory, target) {
  const relative = path.relative(directory, target);
  return !relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolveOutputDirectory(value, inputDirectories) {
  const absolute = path.resolve(value);
  const parent = fs.realpathSync(path.dirname(absolute));
  const output = path.join(parent, path.basename(absolute));
  if (inputDirectories.some(directory => isWithin(directory, output))) {
    throw new Error(
      'Output directory must be outside every instruction snapshot and registry directory',
    );
  }
  try {
    fs.lstatSync(output);
  } catch (error) {
    if (error.code === 'ENOENT') return output;
    throw error;
  }
  throw new Error('Output directory must be new; existing reports are never overwritten');
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function urlCsv(report) {
  const columns = [
    'recordType',
    'kind',
    'code',
    'id',
    'name',
    'path',
    'url',
    'expectedStatus',
    'location',
    'canonicalUrl',
    'robots',
    'inSitemap',
    'reason',
    'count',
    'totalPages',
  ];
  const rows = [
    ...report.urls.map(item => ({ ...item, recordType: 'page' })),
    ...report.redirects.map(item => ({ ...item, recordType: 'redirect' })),
    ...(report.technicalUrls ?? []).map(item => ({ ...item, recordType: 'technical' })),
  ];
  return `\uFEFF${[columns, ...rows.map(item => columns.map(column => item[column]))]
    .map(row => row.map(csvCell).join(';'))
    .join('\r\n')}\r\n`;
}

function markdownText(value) {
  return String(value)
    .replace(/[<>\r\n]/gu, ' ')
    .replaceAll('|', '\\|');
}

function issueCounts(issues) {
  return {
    errors: issues.filter(issue => issue.severity === 'error').length,
    warnings: issues.filter(issue => issue.severity === 'warning').length,
  };
}

function humanReport(report, httpReport) {
  const counts = issueCounts(report.issues);
  const lines = [
    '# Приёмочная проверка структуры инструкций',
    '',
    `Дата: ${report.createdAt}.`,
    `Основной адрес: ${report.origin}.`,
    '',
    'Этот отчёт описывает переданный снимок данных. Он не публикует страницы, не применяет CSV,',
    'не создаёт резервную копию и не изменяет инструкции или справочник.',
    '',
    `Адресов страниц: ${report.urls.length}; исторических адресов: ${report.redirects.length}.`,
    `Ошибок модели: ${counts.errors}; предупреждений: ${counts.warnings}.`,
    '',
    'Файлы:',
    '',
    '- `acceptance.json` — полный отчёт, входные SHA-256 и ожидаемые SEO-настройки.',
    '- `urls.csv` — перечень страниц и исторических адресов в UTF-8 BOM, разделитель `;`.',
    '',
  ];
  if (httpReport) {
    const httpCounts = issueCounts(httpReport.issues);
    lines.push(
      `HTTP-проверка выполнена через ${httpReport.requestOrigin}.`,
      `Ошибок HTTP: ${httpCounts.errors}; предупреждений: ${httpCounts.warnings}.`,
      '`http-report.json` содержит фактические результаты HTTP/HTML и ограничения проверки.',
      'Основной адрес выше используется для canonical и sitemap даже при проверке тестового сервера.',
      '',
    );
  } else {
    lines.push(
      'HTTP-проверка не выполнялась. Коды ответов и SEO в urls.csv — ожидаемые значения модели,',
      'а не подтверждение работы Nginx или опубликованного сайта.',
      '',
    );
  }
  if (!report.baseline || report.baseline.checked === false) {
    lines.push(
      'Сравнение с прежним снимком не подтверждено: без --baseline-directory этот отчёт',
      'не доказывает сохранность прежних URL, текста и файлов после переноса.',
      '',
    );
  }
  lines.push(
    'Проверка не подтверждает адаптивность, JavaScript-переходы, права администратора, скачивание',
    'или восстановление резервной копии. Эти сценарии выполняются отдельно по инструкции администратора.',
    '',
    '## Замечания модели',
    '',
  );
  if (!report.issues.length) lines.push('Замечаний модели нет.');
  for (const issue of report.issues) {
    lines.push(
      `- ${markdownText(issue.severity)} / ${markdownText(issue.code)}: ${markdownText(issue.detail ?? issue.message ?? '')}`,
    );
  }
  lines.push(
    '',
    '## Статистика модели',
    '',
    '```json',
    JSON.stringify(report.counts, null, 2),
    '```',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function assertInputsUnchanged(snapshot, baseline, registryInput) {
  for (const supplied of [snapshot, baseline].filter(Boolean)) {
    const current = readSnapshot(supplied.directory);
    if (JSON.stringify(current.fingerprints) !== JSON.stringify(supplied.fingerprints)) {
      throw new Error('Instruction snapshot changed during audit; repeat with a stable copy');
    }
  }
  if (readRegistry(registryInput.file).sha256 !== registryInput.sha256) {
    throw new Error('Registry input changed during audit; repeat with a stable copy');
  }
}

export async function checkInstructionTaxonomyAcceptance(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      directory: { type: 'string' },
      registry: { type: 'string' },
      origin: { type: 'string', default: 'https://boykovdocs.ru' },
      'baseline-directory': { type: 'string' },
      'http-origin': { type: 'string' },
      'output-dir': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/checkInstructionTaxonomyAcceptance.js ' +
        '--directory INSTRUCTION_SNAPSHOT --output-dir NEW_REPORT_DIRECTORY ' +
        '[--registry REGISTRY.json] [--origin https://boykovdocs.ru] ' +
        '[--baseline-directory BEFORE_SNAPSHOT] [--http-origin http://127.0.0.1:3000]\n' +
        'Read-only audit. Omitted --registry uses the committed seed, never runtime storage. ' +
        'Output parent must exist; the report directory must be new and outside snapshots and the registry directory. ' +
        'Exit codes: 0 no errors, 1 audit findings, 2 invalid input or audit failure.',
    );
    return null;
  }
  for (const option of ['directory', 'output-dir']) {
    if (!values[option]) throw new Error(`--${option} is required`);
  }
  const origin = instructionTaxonomyCsvOrigin(values.origin);
  const requestOrigin = values['http-origin']
    ? instructionTaxonomyCsvOrigin(values['http-origin'])
    : null;
  const snapshot = readSnapshot(values.directory);
  const baseline = values['baseline-directory'] ? readSnapshot(values['baseline-directory']) : null;
  const registryInput = readRegistry(values.registry || SEED_FILE);
  const registry = values.registry
    ? registryInput.registry
    : structuredClone(registryInput.registry.registrySeed);
  const outputDirectory = resolveOutputDirectory(
    values['output-dir'],
    [snapshot.directory, baseline?.directory, path.dirname(registryInput.file)].filter(Boolean),
  );
  const report = {
    ...buildInstructionTaxonomyAcceptanceReport({
      registry,
      instructions: snapshot.instructions,
      origin,
      baselineInstructions: baseline?.instructions ?? null,
    }),
    createdAt: new Date().toISOString(),
    inputs: {
      registry: {
        file: registryInput.file,
        sha256: registryInput.sha256,
        source: values.registry ? 'explicit-snapshot' : 'committed-seed',
      },
      instructions: { directory: snapshot.directory, files: snapshot.fingerprints },
      baseline: baseline ? { directory: baseline.directory, files: baseline.fingerprints } : null,
    },
    writesToInputs: false,
  };
  const httpReport = requestOrigin
    ? await auditInstructionTaxonomyHttp({ report, requestOrigin })
    : null;
  assertInputsUnchanged(snapshot, baseline, registryInput);
  fs.mkdirSync(outputDirectory, { mode: 0o700 });
  const write = (name, text) =>
    fs.writeFileSync(path.join(outputDirectory, name), text, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  write('acceptance.json', `${JSON.stringify(report, null, 2)}\n`);
  write('urls.csv', urlCsv(report));
  if (httpReport) write('http-report.json', `${JSON.stringify(httpReport, null, 2)}\n`);
  write('report.md', humanReport(report, httpReport));
  const errors = issueCounts(report.issues).errors + issueCounts(httpReport?.issues ?? []).errors;
  console.log(
    JSON.stringify(
      {
        outputDirectory,
        scope: report.scope,
        counts: report.counts,
        errors,
        httpChecked: Boolean(httpReport),
        writesToInputs: false,
      },
      null,
      2,
    ),
  );
  return { report, httpReport, outputDirectory, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkInstructionTaxonomyAcceptance();
    if (result?.errors) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
