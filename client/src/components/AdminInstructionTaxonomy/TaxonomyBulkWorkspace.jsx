import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInstructionAssignmentTaxonomy } from '../AdminInstructions/instructionEditorApi.js';
import TaxonomyBindingTable from './TaxonomyBindingTable.jsx';
import TaxonomyBulkHistory from './TaxonomyBulkHistory.jsx';
import TaxonomyBulkPreview from './TaxonomyBulkPreview.jsx';
import {
  applyTaxonomyOperation,
  downloadTaxonomyFile,
  exportPublishedTaxonomyAssignments,
  fetchTaxonomyBindings,
  fetchTaxonomyOperationStatus,
  previewTaxonomyOperation,
  previewTaxonomyRollback,
  recoverTaxonomyOperation,
} from './taxonomyOperationsApi.js';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

const EMPTY_FILTERS = { query: '', section: '', tag: '' };

export default function TaxonomyBulkWorkspace({
  token,
  hidden,
  view,
  request,
  onChanged,
  onBusyChange,
}) {
  const [dictionary, setDictionary] = useState(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryError, setDictionaryError] = useState('');
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionType, setActionType] = useState('set-section');
  const [targetSection, setTargetSection] = useState('');
  const [targetTags, setTargetTags] = useState([]);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewView, setPreviewView] = useState('bindings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const filtersDirty = JSON.stringify(filters) !== JSON.stringify(filterDraft);
  const blocked = !status || status.blocked;

  const loadDictionary = useCallback(async () => {
    setDictionaryLoading(true);
    setDictionaryError('');
    setPreview(null);
    try {
      setDictionary(await fetchInstructionAssignmentTaxonomy(token));
    } catch (reason) {
      setDictionaryError(reason.message);
    } finally {
      setDictionaryLoading(false);
    }
  }, [token]);

  const loadStatus = useCallback(async () => {
    setStatusError('');
    try {
      setStatus(await fetchTaxonomyOperationStatus(token));
    } catch (reason) {
      setStatus(null);
      setStatusError(reason.message);
    }
  }, [token]);

  useEffect(() => {
    if (!hidden) loadStatus();
    if (!hidden && !startedRef.current) {
      startedRef.current = true;
      loadDictionary();
    }
  }, [hidden, loadDictionary, loadStatus]);

  useEffect(() => {
    if (hidden || view !== 'bindings') return undefined;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setListError('');
    fetchTaxonomyBindings(token, { ...filters, page, pageSize })
      .then(value => {
        if (!cancelled) setData(value);
      })
      .catch(reason => {
        if (!cancelled) setListError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, hidden, view, filters, page, pageSize, refresh]);

  useEffect(() => {
    if (!request) return;
    const next = {
      query: '',
      section: request.kind === 'section' ? request.code : '',
      tag: request.kind === 'tag' ? request.code : '',
    };
    setFilters(next);
    setFilterDraft(next);
    setPage(1);
    setSelectedIds([]);
    setPreview(null);
    setScopeConfirmed(false);
    setError('');
    setMessage('');
    if (request.targetSectionId) {
      setActionType('set-section');
      setTargetSection(request.targetSectionId);
      setTargetTags([]);
    } else if (request.kind === 'tag') {
      setActionType('remove-tags');
      setTargetTags([request.code]);
      setTargetSection('');
    } else {
      setActionType('set-section');
      setTargetSection('');
      setTargetTags([]);
    }
  }, [request]);

  useEffect(() => {
    if (!selectedIds.length && !preview) return undefined;
    function guardUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', guardUnload);
    return () => window.removeEventListener('beforeunload', guardUnload);
  }, [selectedIds.length, preview]);

  function invalidate() {
    setPreview(null);
    setScopeConfirmed(false);
    setError('');
    setMessage('');
  }

  function changeFilter(field, value) {
    setFilterDraft(current => ({ ...current, [field]: value }));
    setSelectedIds([]);
    invalidate();
  }

  function applyFilters(event) {
    event.preventDefault();
    setFilters({ ...filterDraft, query: filterDraft.query.trim() });
    setFilterDraft(current => ({ ...current, query: current.query.trim() }));
    setPage(1);
    setSelectedIds([]);
    invalidate();
    setRefresh(value => value + 1);
  }

  function select(id) {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    );
    invalidate();
  }

  function selectPage(checked) {
    const ids = data.items.map(item => item.id);
    setSelectedIds(current =>
      checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id)),
    );
    invalidate();
  }

  function startBusy() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setMessage('');
    return true;
  }

  function stopBusy() {
    busyRef.current = false;
    setBusy(false);
    onBusyChange?.(false);
  }

  function actionInput() {
    if (actionType === 'set-section') {
      if (!dictionary.sections.some(item => item.id === targetSection))
        throw new Error('Выберите доступный тематический раздел назначения.');
      return { type: actionType, sectionId: targetSection };
    }
    const known = new Set(
      [...dictionary.tags, ...(actionType === 'remove-tags' ? dictionary.legacyTags : [])].map(
        item => item.id,
      ),
    );
    if (!targetTags.length || targetTags.some(id => !known.has(id)))
      throw new Error('Выберите доступные теги для этой операции.');
    return { type: actionType, tagIds: [...targetTags] };
  }

  async function prepare() {
    if (busyRef.current || !dictionary || blocked || !scopeConfirmed || !selectedIds.length) return;
    let action;
    try {
      action = actionInput();
    } catch (reason) {
      setError(reason.message);
      return;
    }
    if (!startBusy()) return;
    setPreview(null);
    try {
      const value = await previewTaxonomyOperation(token, {
        ids: [...selectedIds],
        registryRevision: dictionary.revision,
        includeDrafts: true,
        action,
      });
      setPreview(value);
      setPreviewView('bindings');
    } catch (reason) {
      setError(
        `${reason.message}${reason.status === 409 ? ' Выбор сохранён. Обновите справочник при необходимости и создайте новый предпросмотр.' : ''}`,
      );
      loadStatus();
    } finally {
      stopBusy();
    }
  }

  async function apply(previewId) {
    if (blocked || !startBusy()) return;
    try {
      const result = await applyTaxonomyOperation(token, previewId);
      setPreview(null);
      setSelectedIds([]);
      setScopeConfirmed(false);
      setMessage(
        `Операция ${result.operationId} применена. Инструкций с изменениями: ${result.counts.changedDocuments}; версий: ${result.counts.changedVersions}.`,
      );
      setRefresh(value => value + 1);
      onChanged?.();
      await loadStatus();
    } catch (reason) {
      setPreview(null);
      setError(
        `${reason.message} Выбранные инструкции и параметры сохранены. Для повторной попытки создайте новый предпросмотр.`,
      );
      await loadStatus();
    } finally {
      stopBusy();
    }
  }

  async function rollbackPreview(operationId) {
    if (!dictionary || blocked || !startBusy()) return;
    setPreview(null);
    try {
      const value = await previewTaxonomyRollback(token, operationId);
      setPreview(value);
      setPreviewView('history');
    } catch (reason) {
      setError(reason.message);
      loadStatus();
    } finally {
      stopBusy();
    }
  }

  async function recover() {
    if (!status?.pendingOperation || busyRef.current) return;
    if (
      !window.confirm(
        'Восстановить незавершённую операцию? Сервер вернёт данные к состоянию до неё либо завершит уборку уже зафиксированной операции.',
      )
    )
      return;
    if (!startBusy()) return;
    setPreview(null);
    try {
      await recoverTaxonomyOperation(token, status.pendingOperation.operationId);
      setMessage(
        'Восстановление завершено. Проверьте журнал и создайте новый предпросмотр перед изменениями.',
      );
      setRefresh(value => value + 1);
      onChanged?.();
    } catch (reason) {
      setError(reason.message);
    } finally {
      await loadStatus();
      stopBusy();
    }
  }

  async function exportCsv() {
    if (!startBusy()) return;
    try {
      downloadTaxonomyFile(
        await exportPublishedTaxonomyAssignments(token),
        'instruction-taxonomy-published.csv',
      );
      setMessage('Экспорт опубликованных назначений подготовлен.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      stopBusy();
    }
  }

  const sectionOptions = [...(dictionary?.sections || []), ...(dictionary?.legacyCategories || [])];
  const tagOptions = [...(dictionary?.tags || []), ...(dictionary?.legacyTags || [])];
  const actionTags = actionType === 'remove-tags' ? tagOptions : dictionary?.tags || [];
  const knownTargetTags = new Set(actionTags.map(item => item.id));
  const unknownTargetTags = targetTags.filter(id => !knownTargetTags.has(id));

  return (
    <div hidden={hidden} className={styles.workspace}>
      <div className={styles.inlineHead}>
        <p className={base.muted}>
          Фильтры учитывают назначения в любой сохранённой версии. Экспорт содержит только
          опубликованные назначения всех инструкций.
        </p>
        <button
          className={base.button}
          type="button"
          disabled={busy || dictionaryLoading}
          onClick={loadDictionary}
        >
          {dictionaryLoading ? 'Загрузка справочника…' : 'Обновить справочник'}
        </button>
      </div>
      {dictionaryError && (
        <p className={base.error} role="alert">
          {dictionaryError} Выбор сохранён.
        </p>
      )}
      {statusError && (
        <div className={base.error} role="alert">
          <p>{statusError} Сначала проверьте состояние операций.</p>
          <button className={base.button} type="button" disabled={busy} onClick={loadStatus}>
            Повторить проверку состояния
          </button>
        </div>
      )}
      {status?.blocked && (
        <div className={base.notice} role="alert">
          <p>
            Есть незавершённая операция {status.pendingOperation?.operationId}. Новые изменения
            временно заблокированы.
          </p>
          <button
            className={base.button}
            type="button"
            disabled={busy || !status.pendingOperation}
            onClick={recover}
          >
            Восстановить незавершённую операцию
          </button>
        </div>
      )}
      {error && (
        <p className={base.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={base.success} role="status">
          {message}
        </p>
      )}
      <section
        hidden={view !== 'bindings'}
        className={styles.bindings}
        aria-labelledby="taxonomy-bindings-heading"
      >
        <div className={styles.inlineHead}>
          <h3 id="taxonomy-bindings-heading">Привязки инструкций</h3>
          <button
            className={base.button}
            type="button"
            disabled={busy || blocked}
            onClick={exportCsv}
          >
            Экспорт опубликованных назначений (CSV)
          </button>
        </div>
        <form onSubmit={applyFilters}>
          <div className={styles.filters}>
            <label className={base.label}>
              Название или ID
              <input
                className={base.input}
                type="search"
                value={filterDraft.query}
                disabled={busy}
                onChange={event => changeFilter('query', event.target.value)}
              />
            </label>
            <label className={base.label}>
              Раздел или прежняя категория
              <select
                className={base.input}
                value={filterDraft.section}
                disabled={busy || !dictionary}
                onChange={event => changeFilter('section', event.target.value)}
              >
                <option value="">Все разделы</option>
                {sectionOptions.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.label}
                    {dictionary?.legacyCategories.some(other => other.id === item.id)
                      ? ' (прежняя категория)'
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={base.label}>
              Тег
              <select
                className={base.input}
                value={filterDraft.tag}
                disabled={busy || !dictionary}
                onChange={event => changeFilter('tag', event.target.value)}
              >
                <option value="">Все теги</option>
                {tagOptions.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.label}
                    {dictionary?.legacyTags.some(other => other.id === item.id)
                      ? ' (прежний тег)'
                      : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.inline}>
            <button className={base.button} type="submit" disabled={busy || loading}>
              Применить фильтры
            </button>
            <button
              className={base.button}
              type="button"
              disabled={busy || loading}
              onClick={() => {
                setFilterDraft(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
                setPage(1);
                setSelectedIds([]);
                invalidate();
                setRefresh(value => value + 1);
              }}
            >
              Сбросить фильтры
            </button>
            {filtersDirty && (
              <span className={base.muted}>Примените фильтры перед выбором инструкций.</span>
            )}
          </div>
        </form>
        {listError && (
          <div className={base.error} role="alert">
            <p>{listError}</p>
            <button
              className={base.button}
              type="button"
              disabled={busy || loading}
              onClick={() => setRefresh(value => value + 1)}
            >
              Повторить загрузку
            </button>
          </div>
        )}
        <TaxonomyBindingTable
          data={data}
          dictionary={dictionary}
          selectedIds={selectedIds}
          disabled={busy || filtersDirty || !dictionary}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onSelect={select}
          onSelectPage={selectPage}
          onPage={setPage}
          onPageSize={value => {
            setPageSize(value);
            setPage(1);
          }}
        />
        {selectedIds.length > 0 && (
          <div className={styles.inline}>
            <details className={styles.selection}>
              <summary>Показать выбранные ID ({selectedIds.length})</summary>
              {selectedIds.join(', ')}
            </details>
            <button
              className={base.button}
              type="button"
              disabled={busy}
              onClick={() => {
                setSelectedIds([]);
                invalidate();
              }}
            >
              Снять выбор
            </button>
          </div>
        )}
        <section className={styles.action} aria-labelledby="taxonomy-operation-heading">
          <h3 id="taxonomy-operation-heading">Массовое изменение</h3>
          <div className={styles.actionFields}>
            <label className={base.label}>
              Действие
              <select
                className={base.input}
                value={actionType}
                disabled={busy}
                onChange={event => {
                  setActionType(event.target.value);
                  setTargetTags([]);
                  invalidate();
                }}
              >
                <option value="set-section">Назначить основной раздел</option>
                <option value="add-tags">Добавить теги</option>
                <option value="remove-tags">Снять теги</option>
              </select>
            </label>
            {actionType === 'set-section' ? (
              <label className={base.label}>
                Раздел назначения
                <select
                  className={base.input}
                  value={targetSection}
                  disabled={busy || !dictionary}
                  onChange={event => {
                    setTargetSection(event.target.value);
                    invalidate();
                  }}
                >
                  <option value="">Выберите раздел</option>
                  {targetSection &&
                    !dictionary?.sections.some(item => item.id === targetSection) && (
                      <option value={targetSection}>{targetSection} · недоступное значение</option>
                    )}
                  {dictionary?.catalogs.map(catalog => (
                    <optgroup key={catalog.id} label={`${catalog.id} · ${catalog.label}`}>
                      {dictionary.sections
                        .filter(item => item.catalogId === catalog.id)
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {item.id} · {item.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : (
              <label className={base.label}>
                {actionType === 'add-tags' ? 'Теги для добавления' : 'Теги для снятия (точные ID)'}
                <select
                  className={base.input}
                  multiple
                  size={7}
                  value={targetTags}
                  disabled={busy || !dictionary}
                  onChange={event => {
                    setTargetTags([...event.target.selectedOptions].map(option => option.value));
                    invalidate();
                  }}
                >
                  {unknownTargetTags.map(id => (
                    <option key={id} value={id}>
                      {id} · недоступное значение
                    </option>
                  ))}
                  {actionTags.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.label}
                      {dictionary?.legacyTags.some(other => other.id === item.id)
                        ? ' (прежний тег)'
                        : ''}
                    </option>
                  ))}
                </select>
                <small>
                  Для нескольких значений используйте Ctrl/Cmd или Shift. Прежние и новые теги не
                  сопоставляются автоматически.
                </small>
              </label>
            )}
          </div>
          <label className={base.check}>
            <input
              type="checkbox"
              checked={scopeConfirmed}
              disabled={busy || !selectedIds.length}
              onChange={event => {
                setScopeConfirmed(event.target.checked);
                setPreview(null);
              }}
            />
            Подтверждаю обработку опубликованной версии и каждого сохранённого черновика выбранных
            инструкций, в том числе старых. Черновики не будут опубликованы.
          </label>
          <div className={styles.inline}>
            <button
              className={`${base.button} ${base.primary}`}
              type="button"
              disabled={
                busy ||
                blocked ||
                !dictionary ||
                dictionaryLoading ||
                !scopeConfirmed ||
                !selectedIds.length ||
                filtersDirty
              }
              onClick={prepare}
            >
              Предпросмотр изменений
            </button>
            <span className={base.muted}>Выбрано ID: {selectedIds.length}</span>
          </div>
        </section>
      </section>
      <TaxonomyBulkHistory
        token={token}
        hidden={hidden || view !== 'history'}
        dictionary={dictionary}
        refresh={refresh}
        busy={busy}
        blocked={blocked || !dictionary}
        onRollbackPreview={rollbackPreview}
      />
      {preview && previewView === view && (
        <TaxonomyBulkPreview
          key={preview.previewId}
          preview={preview}
          dictionary={dictionary}
          busy={busy}
          blocked={blocked}
          onApply={apply}
          onDismiss={() => setPreview(null)}
        />
      )}
    </div>
  );
}
