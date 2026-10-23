import { useEffect, useState } from 'react';
import { fetchTaxonomyOperationHistory } from './taxonomyOperationsApi.js';
import {
  BulkPagination,
  OperationCounts,
  dateLabel,
  operationLabel,
  taxonomyLabels,
} from './TaxonomyBulkDetails.jsx';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

const STATUS_LABELS = {
  preview: 'Предпросмотр, не применена',
  applying: 'Применение не завершено',
  committed: 'Применена',
  pending: 'Незавершённая',
  prepared: 'Подготовлена',
  'rolled-back': 'Восстановлена',
  recovered: 'Восстановлена',
  failed: 'Ошибка',
};

export default function TaxonomyBulkHistory({
  token,
  hidden,
  dictionary,
  refresh,
  busy,
  blocked,
  onRollbackPreview,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const labels = taxonomyLabels(dictionary);

  useEffect(() => {
    if (hidden) return undefined;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError('');
    fetchTaxonomyOperationHistory(token, page, pageSize)
      .then(value => {
        if (!cancelled) setData(value);
      })
      .catch(reason => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, hidden, page, pageSize, refresh, attempt]);

  return (
    <section hidden={hidden} className={styles.history} aria-labelledby="taxonomy-history-heading">
      <div className={styles.inlineHead}>
        <h3 id="taxonomy-history-heading">Журнал операций</h3>
        <button
          className={base.button}
          type="button"
          disabled={busy || loading}
          onClick={() => setAttempt(value => value + 1)}
        >
          Обновить журнал
        </button>
      </div>
      <p className={base.muted}>
        Откат начинается с отдельного предпросмотра. Если назначения уже изменились, сначала
        разрешите конфликт; текущие данные не заменяются без проверки.
      </p>
      {error && (
        <p className={base.error} role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Загрузка журнала…</p>}
      {data?.items.map(item => (
        <article key={item.operationId} className={styles.operation}>
          <div className={styles.inlineHead}>
            <div>
              <strong>
                {item.kind === 'rollback' ? 'Откат' : 'Массовая операция'} ·{' '}
                {STATUS_LABELS[item.status] || item.status}
              </strong>
              <p className={base.muted}>
                {dateLabel(item.completedAt || item.committedAt || item.createdAt)} ·{' '}
                {item.operationId}
              </p>
              {item.actor && <p className={base.muted}>Администратор: {item.actor}</p>}
            </div>
            <button
              className={base.button}
              type="button"
              disabled={
                busy || loading || blocked || item.status !== 'committed' || item.kind !== 'apply'
              }
              onClick={() => onRollbackPreview(item.operationId)}
            >
              Предпросмотр отката
            </button>
          </div>
          <p>{operationLabel(item.action, labels)}</p>
          {item.rollbackOf && <p className={base.muted}>Откат операции: {item.rollbackOf}</p>}
          <details>
            <summary>Подробности операции</summary>
            <OperationCounts counts={item.counts} />
          </details>
        </article>
      ))}
      {data && !data.items.length && <p className={base.muted}>Сохранённых операций пока нет.</p>}
      {data && (
        <BulkPagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          disabled={busy || loading}
          onPage={setPage}
          onPageSize={value => {
            setPageSize(value);
            setPage(1);
          }}
          label="Страницы журнала операций"
        />
      )}
    </section>
  );
}
