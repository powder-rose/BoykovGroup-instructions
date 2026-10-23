import { useState } from 'react';
import {
  AssignmentDetails,
  BulkPagination,
  CsvImportCounts,
  taxonomyLabels,
} from './TaxonomyBulkDetails.jsx';
import { downloadTaxonomyFile } from './taxonomyOperationsApi.js';
import { safeCsvImportReport } from './taxonomyImportReport.js';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

const STATUS_LABELS = {
  candidate: 'Допущена к предпросмотру',
  review: 'Нужна ручная проверка',
  'source-error': 'Ошибка данных',
  'not-found': 'Инструкция не найдена',
  ambiguous: 'Неоднозначное совпадение',
  'invalid-url': 'Некорректный URL',
};

export default function TaxonomyCsvImportReport({ report, dictionary, busy }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const labels = taxonomyLabels(dictionary);
  const filtered = report.records.filter(record => !status || record.status === status);
  const rows = filtered.slice((page - 1) * 25, page * 25);

  function download() {
    downloadTaxonomyFile(
      new Blob([JSON.stringify(safeCsvImportReport(report), null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      'instruction-taxonomy-import-report.json',
    );
  }

  return (
    <section className={styles.action} aria-labelledby="taxonomy-csv-report-heading">
      <div className={styles.inlineHead}>
        <h3 id="taxonomy-csv-report-heading">Отчёт проверки CSV</h3>
        <button className={base.button} type="button" disabled={busy} onClick={download}>
          Скачать отчёт (JSON)
        </button>
      </div>
      <p>
        {report.file.name} · {report.file.bytes.toLocaleString('ru-RU')} байт ·{' '}
        {report.tagMode === 'replace' ? 'Полная замена тегов' : 'Добавление тегов'}
      </p>
      <details>
        <summary>Контрольная сумма файла и версия справочника</summary>
        <p className={base.muted}>SHA-256: {report.file.sha256}</p>
        <p className={base.muted}>Версия справочника: {report.registryRevision}</p>
      </details>
      <CsvImportCounts counts={report.counts} />
      <p className={base.muted}>
        Счётчики найденных инструкций, ошибок и ручной проверки могут пересекаться. К изменениям
        допускаются только строки без ошибок с единственным совпадением и без ручной проверки.
        Названия из CSV используются для сверки и не заменяют названия инструкций.
      </p>
      {report.counts.manualReview > 0 && (
        <p className={base.notice}>
          Строки с ручной проверкой исключены. Для 63 спорных записей исходного реестра защита
          действует даже при очищенном статусе в загруженном CSV. После экспертной проверки
          назначение такой инструкции можно изменить отдельно в существующем редакторе.
        </p>
      )}
      {report.unknownSectionIds?.length > 0 && (
        <p className={base.error}>
          Неизвестные коды разделов: {report.unknownSectionIds.join(', ')}
        </p>
      )}
      {report.unknownTagIds?.length > 0 && (
        <p className={base.error}>Неизвестные коды тегов: {report.unknownTagIds.join(', ')}</p>
      )}
      {!report.counts.eligibleRows && (
        <p className={base.notice}>Допущенных строк нет. Применение изменений недоступно.</p>
      )}
      <label className={base.label}>
        Показать строки
        <select
          className={base.input}
          value={status}
          disabled={busy}
          onChange={event => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>Сопоставление CSV по действующим URL и причины исключения строк</caption>
          <thead>
            <tr>
              <th scope="col">Строка и номер реестра</th>
              <th scope="col">URL и найденная инструкция</th>
              <th scope="col">Предложено в CSV</th>
              <th scope="col">Статус и замечания</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(record => (
              <tr key={record.row}>
                <th scope="row">
                  Строка {record.row}
                  <small>document_id: {record.documentId || '—'}</small>
                </th>
                <td>
                  <p>{record.url}</p>
                  <p>ID инструкции: {record.existingId || 'не установлен'}</p>
                  {record.currentUrl && <p>Текущий URL: {record.currentUrl}</p>}
                  {record.titleFromUrlVerify && (
                    <details>
                      <summary>Название из CSV для сверки</summary>
                      <p>{record.titleFromUrlVerify}</p>
                    </details>
                  )}
                </td>
                <td>
                  <AssignmentDetails
                    assignment={{
                      primaryCategoryId: record.proposed.sectionId,
                      tagIds: record.proposed.tagIds,
                    }}
                    labels={labels}
                  />
                </td>
                <td>
                  <strong>{STATUS_LABELS[record.status] || record.status}</strong>
                  {record.manualReview && record.status !== 'review' && (
                    <p>Нужна ручная проверка.</p>
                  )}
                  {record.reviewReasons?.length > 0 && (
                    <ul>
                      {[...new Set(record.reviewReasons)].map(reason => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {record.errors.length > 0 && (
                    <ul>
                      {[
                        ...new Map(
                          record.errors.map(error => [`${error.code}/${error.message}`, error]),
                        ).entries(),
                      ].map(([key, error]) => (
                        <li key={key}>
                          {error.message} <small>({error.code})</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className={base.muted}>Строк с выбранным статусом нет.</p>}
      <BulkPagination
        page={page}
        pageSize={25}
        total={filtered.length}
        disabled={busy}
        onPage={setPage}
        label="Страницы отчёта импорта"
      />
    </section>
  );
}
