export const MAX_TAXONOMY_CSV_BYTES = 4 * 1024 * 1024;

export const CSV_IMPORT_COUNT_LABELS = [
  ['rows', 'Прочитано строк'],
  ['matched', 'Строк с найденной инструкцией'],
  ['notFound', 'Не найдено'],
  ['ambiguous', 'Неоднозначных совпадений'],
  ['invalidUrl', 'Некорректных URL'],
  ['manualReview', 'Требуют ручной проверки'],
  ['sourceInvalid', 'Строк с ошибками'],
  ['unknownSections', 'Неизвестных кодов разделов'],
  ['unknownTags', 'Неизвестных кодов тегов'],
  ['eligibleRows', 'Строк допущено к предпросмотру'],
  ['selectedDocuments', 'Инструкций допущено'],
  ['skippedRows', 'Строк исключено'],
];

export function safeCsvImportReport(report) {
  return {
    file: {
      name: report.file.name,
      sha256: report.file.sha256,
      bytes: report.file.bytes,
    },
    registryRevision: report.registryRevision,
    tagMode: report.tagMode,
    counts: Object.fromEntries(CSV_IMPORT_COUNT_LABELS.map(([key]) => [key, report.counts[key]])),
    unknownSectionIds: [...(report.unknownSectionIds || [])],
    unknownTagIds: [...(report.unknownTagIds || [])],
    records: report.records.map(record => ({
      row: record.row,
      documentId: record.documentId,
      url: record.url,
      titleFromUrlVerify: record.titleFromUrlVerify,
      existingId: record.existingId,
      currentUrl: record.currentUrl,
      match: record.match,
      status: record.status,
      manualReview: record.manualReview,
      reviewReasons: [...(record.reviewReasons || [])],
      proposed: {
        sectionId: record.proposed.sectionId,
        tagIds: [...record.proposed.tagIds],
      },
      errors: record.errors.map(error => ({ code: error.code, message: error.message })),
    })),
  };
}
