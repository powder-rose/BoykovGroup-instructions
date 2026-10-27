const USAGE = `Usage:
  node server/scripts/fillMissingInstructionTags.js --source-root ROOT --bundle FILE --output-dir NEW_DIRECTORY
  node server/scripts/fillMissingInstructionTags.js --source-root ROOT --apply-preview DIRECTORY --writers-stopped
  node server/scripts/fillMissingInstructionTags.js --source-root ROOT --recover-operation UUID --writers-stopped

Default: read-only preview outside the source, with reviewed document and registry checks.
Apply: adds reviewed noindex tags and fills only empty published tags through the bulk journal.
Categories, content, already tagged instructions and drafts are preserved.
Stop all writers and create a verified business-data backup before applying.
No application startup, workers, migrations, network calls or SEO publication.
`;

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(USAGE);
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${key}`);
    if (key === '--writers-stopped') options[key] = true;
    else if (
      [
        '--source-root',
        '--bundle',
        '--output-dir',
        '--apply-preview',
        '--recover-operation',
      ].includes(key) &&
      args[index + 1] &&
      !args[index + 1].startsWith('--')
    )
      options[key] = args[++index];
    else throw new Error(USAGE);
  }
  if (!options['--source-root']) throw new Error(USAGE);
  const applying = Boolean(options['--apply-preview']);
  const recovering = Boolean(options['--recover-operation']);
  if (
    recovering
      ? applying || options['--bundle'] || options['--output-dir'] || !options['--writers-stopped']
      : applying
        ? options['--bundle'] || options['--output-dir'] || !options['--writers-stopped']
        : !options['--bundle'] || !options['--output-dir'] || options['--writers-stopped']
  )
    throw new Error(USAGE);
  const service = await import('../src/services/instructionMissingTagsService.js');
  const result = recovering
    ? service.recoverMissingInstructionTags({
        sourceRoot: options['--source-root'],
        operationId: options['--recover-operation'],
        writersStopped: true,
      })
    : applying
      ? service.applyMissingInstructionTags({
          sourceRoot: options['--source-root'],
          previewDirectory: options['--apply-preview'],
          writersStopped: true,
        })
      : service.previewMissingInstructionTags({
          sourceRoot: options['--source-root'],
          bundleFile: options['--bundle'],
          outputDirectory: options['--output-dir'],
        });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const { pathToFileURL } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error.code ? `${error.code}: ` : ''}${error.message}\n`);
    if (error.details?.operationId)
      process.stderr.write(`OPERATION_ID=${error.details.operationId}\n`);
    process.exitCode = 1;
  });
}
