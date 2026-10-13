/**
 * Создание новой версии инструкции
 */
export function createNewVersion(existing, incoming) {
  const currentVersion = Number(existing.version || '1.0');

  const newVersion = (currentVersion + 0.1).toFixed(1);

  return {
    ...existing,

    title: incoming.title,

    profession: incoming.profession,

    professionKey: incoming.professionKey,

    intro: incoming.intro,

    sections: incoming.sections,

    contentHash: incoming.contentHash,

    version: newVersion,

    updatedAt: new Date().toISOString(),

    versions: [
      ...(existing.versions || []),

      {
        version: existing.version || '1.0',

        createdAt: existing.createdAt,

        updatedAt: existing.updatedAt,

        contentHash: existing.contentHash,
      },

      {
        version: newVersion,

        createdAt: new Date().toISOString(),

        contentHash: incoming.contentHash,
      },
    ],
  };
}

/**
 * Сравнение инструкций
 */
export function compareInstruction(existing, incoming) {
  if (
    existing.contentHash &&
    incoming.contentHash &&
    existing.contentHash === incoming.contentHash
  ) {
    return {
      same: true,

      action: 'duplicate',

      instruction: existing,
    };
  }

  return {
    same: false,

    action: 'new_version',

    instruction: incoming,

    previous: existing,
  };
}
