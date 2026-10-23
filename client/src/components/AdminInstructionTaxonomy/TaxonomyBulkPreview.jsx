import { useState } from 'react';
import {
  AssignmentDetails,
  BulkPagination,
  OperationCounts,
  dateLabel,
  operationLabel,
  taxonomyLabels,
  versionLabel,
} from './TaxonomyBulkDetails.jsx';
import { downloadTaxonomyFile } from './taxonomyOperationsApi.js';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

function safePreviewReport(preview) {
  return {
    previewId: preview.previewId,
    kind: preview.kind,
    createdAt: preview.createdAt,
    expiresAt: preview.expiresAt,
    registryRevision: preview.registryRevision,
    action: preview.action
      ? {
          type: preview.action.type,
          ...(preview.action.sectionId ? { sectionId: preview.action.sectionId } : {}),
          ...(preview.action.tagIds ? { tagIds: [...preview.action.tagIds] } : {}),
          ...(preview.action.operationId ? { operationId: preview.action.operationId } : {}),
        }
      : null,
    counts: {
      selectedDocuments: preview.counts.selectedDocuments,
      changedDocuments: preview.counts.changedDocuments,
      changedVersions: preview.counts.changedVersions,
      updatedVersions: preview.counts.updatedVersions,
      unchangedDocuments: preview.counts.unchangedDocuments,
    },
    ...(preview.rollbackOf ? { rollbackOf: preview.rollbackOf } : {}),
    rows: preview.rows.map(row => ({
      id: row.id,
      title: row.title,
      publishedUrl: row.publishedUrl,
      versions: row.versions.map(version => ({
        version: version.version,
        before: {
          primaryCategoryId: version.before.primaryCategoryId,
          tagIds: version.before.tagIds,
        },
        after: {
          primaryCategoryId: version.after.primaryCategoryId,
          tagIds: version.after.tagIds,
        },
        changed: version.changed,
      })),
    })),
  };
}

export default function TaxonomyBulkPreview({
  preview,
  dictionary,
  busy,
  blocked,
  onApply,
  onDismiss,
}) {
  const [page, setPage] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const labels = taxonomyLabels(dictionary);
  const rows = preview.rows.slice((page - 1) * 25, page * 25);

  function download() {
    downloadTaxonomyFile(
      new Blob([JSON.stringify(safePreviewReport(preview), null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
      'instruction-taxonomy-preview.json',
    );
  }

  return (
    <section className={styles.preview} aria-labelledby="taxonomy-bulk-preview-heading">
      <div className={styles.inlineHead}>
        <h3 id="taxonomy-bulk-preview-heading">
          {preview.kind === 'rollback' ? 'Предпросмотр отката' : 'Предпросмотр изменений'}
        </h3>
        <button className={base.button} type="button" disabled={busy} onClick={download}>
          Скачать отчёт (JSON)
        </button>
      </div>
      <p>{operationLabel(preview.action, labels)}</p>
      <p className={base.muted}>
        Предпросмотр действителен до {dateLabel(preview.expiresAt)}. Изменения ещё не применены.
      </p>
      <OperationCounts counts={preview.counts} />
      <p className={base.muted}>
        Если назначения меняются хотя бы в одной версии инструкции, новая ревизия сохраняется у всех
        её версий. В таблице отдельно показаны изменения самих назначений.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>Все версии выбранных инструкций: до и после</caption>
          <thead>
            <tr>
              <th scope="col">Инструкция и версия</th>
              <th scope="col">До</th>
              <th scope="col">После</th>
              <th scope="col">Результат</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap(row =>
              row.versions.map((version, index) => (
                <tr key={`${row.id}/${version.version}`}>
                  <th scope="row">
                    <span>{row.title}</span>
                    <small>{row.id}</small>
                    <small>
                      {versionLabel(
                        version,
                        row.versions.slice(0, index).filter(item => item.version === 'draft')
                          .length,
                        row.versions.filter(item => item.version === 'draft').length,
                      )}
                    </small>
                  </th>
                  <td>
                    <AssignmentDetails assignment={version.before} labels={labels} />
                  </td>
                  <td>
                    <AssignmentDetails assignment={version.after} labels={labels} />
                  </td>
                  <td>{version.changed ? 'Изменится' : 'Без изменений'}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <BulkPagination
        page={page}
        pageSize={25}
        total={preview.rows.length}
        disabled={busy}
        onPage={setPage}
        label="Страницы предпросмотра"
      />
      <label className={base.check}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || blocked}
          onChange={event => setConfirmed(event.target.checked)}
        />
        Подтверждаю проверенные изменения опубликованных версий и всех сохранённых черновиков.
        Черновики остаются черновиками.
      </label>
      <div className={styles.inline}>
        <button
          className={`${base.button} ${base.primary}`}
          type="button"
          disabled={busy || blocked || !confirmed || !preview.counts.changedVersions}
          onClick={() => onApply(preview.previewId)}
        >
          {busy
            ? 'Подождите…'
            : preview.kind === 'rollback'
              ? 'Применить откат'
              : 'Применить изменения'}
        </button>
        <button className={base.button} type="button" disabled={busy} onClick={onDismiss}>
          Закрыть предпросмотр
        </button>
      </div>
    </section>
  );
}
