export const backupManifest = {
  version: '1.1',

  /*
   * Production business data required
   * for application recovery.
   */
  includedPaths: ['server/src/data', 'server/data'],

  // Account storage is created on the first registration/save.
  optionalPaths: ['server/data'],

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
