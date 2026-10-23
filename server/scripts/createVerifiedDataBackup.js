import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createVerifiedDataBackup } from '../src/backup/verifiedBackupService.js';

export async function runVerifiedDataBackup(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      'source-root': { type: 'string' },
      'output-dir': { type: 'string' },
      'writers-stopped': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node server/scripts/createVerifiedDataBackup.js ' +
        '--source-root REPOSITORY_ROOT --output-dir NEW_BACKUP_DIRECTORY --writers-stopped\n' +
        'Source root must contain server/src/data. Stop every source writer before acknowledging ' +
        '--writers-stopped. Creates a private backup and verifies extraction only in a new isolated ' +
        'directory; it never restores over the source. Output parent must exist and be outside the ' +
        'source. No application startup, migrations or publication. Exit codes: 0 verified, 1 failure.',
    );
    return null;
  }
  for (const option of ['source-root', 'output-dir']) {
    if (!values[option]?.trim()) throw new Error(`--${option} is required`);
  }
  if (!values['writers-stopped']) {
    throw new Error('Stop all source writers and explicitly pass --writers-stopped');
  }
  const report = await createVerifiedDataBackup({
    sourceRoot: values['source-root'],
    outputDir: values['output-dir'],
    writersStopped: values['writers-stopped'],
  });
  console.log(
    JSON.stringify(
      {
        status: report.status,
        outputDir: report.outputDir,
        archivePath: report.archivePath,
        checksumPath: report.checksumPath,
        restoredRoot: report.restoredRoot,
        reportPath: report.reportPath,
        counts: report.counts,
      },
      null,
      2,
    ),
  );
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runVerifiedDataBackup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
