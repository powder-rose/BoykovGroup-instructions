import {
  AssignmentDetails,
  BulkPagination,
  taxonomyLabels,
  versionLabel,
} from './TaxonomyBulkDetails.jsx';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

export default function TaxonomyBindingTable({
  data,
  dictionary,
  selectedIds,
  disabled,
  loading,
  page,
  pageSize,
  onSelect,
  onSelectPage,
  onPage,
  onPageSize,
}) {
  const labels = taxonomyLabels(dictionary);
  const allOnPage = Boolean(
    data?.items.length && data.items.every(item => selectedIds.includes(item.id)),
  );
  return (
    <>
      <p className={base.muted} role="status">
        Выбрано инструкций: {selectedIds.length}. Флажок в заголовке выбирает только текущую
        страницу. Выбор сохраняется при переходе между страницами.
      </p>
      {loading && <p role="status">Загрузка инструкций…</p>}
      {data && (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption>Назначения опубликованных версий и всех сохранённых черновиков</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Выбрать все инструкции текущей страницы"
                      checked={allOnPage}
                      disabled={disabled || loading || !data.items.length}
                      onChange={event => onSelectPage(event.target.checked)}
                    />
                  </th>
                  <th scope="col">Инструкция</th>
                  <th scope="col">Все сохранённые версии</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Выбрать инструкцию ${item.title}`}
                        checked={selectedIds.includes(item.id)}
                        disabled={disabled || loading}
                        onChange={() => onSelect(item.id)}
                      />
                    </td>
                    <th scope="row">
                      <span>{item.title}</span>
                      <small>{item.id}</small>
                      {item.publishedUrl && (
                        <small>
                          <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer">
                            Открыть опубликованную страницу
                          </a>
                        </small>
                      )}
                    </th>
                    <td>
                      <div className={styles.versions}>
                        {item.versions.map((version, index) => (
                          <div
                            key={`${version.version}/${version.revision}`}
                            className={styles.version}
                          >
                            <strong>
                              {versionLabel(
                                version,
                                item.versions
                                  .slice(0, index)
                                  .filter(other => other.version === 'draft').length,
                                item.versions.filter(other => other.version === 'draft').length,
                              )}
                            </strong>
                            <AssignmentDetails assignment={version} labels={labels} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && (
            <p className={base.muted}>По выбранным фильтрам инструкции не найдены.</p>
          )}
          <BulkPagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            disabled={disabled || loading}
            onPage={onPage}
            onPageSize={onPageSize}
            label="Страницы привязок инструкций"
          />
        </>
      )}
    </>
  );
}
