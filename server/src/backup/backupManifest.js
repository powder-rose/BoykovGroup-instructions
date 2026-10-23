export const backupManifest = {
  version: '1.2',

  /*
   * Production business data required
   * for application recovery.
   */
  includedPaths: ['server/src/data', 'server/data', 'server/uploads'],

  // Account and import storage are created on first use.
  optionalPaths: ['server/data', 'server/uploads'],

  /*
   * Runtime/build artifacts are recreated
   * during deployment and are not backed up.
   */
  excludedPaths: ['node_modules', 'dist', 'logs', '.git'],

  /*
   * Keep enough history to recover
   * from accidental corruption.
   */
  retentionDays: 14,
};
