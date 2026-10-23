import { useCallback, useEffect, useRef, useState } from 'react';
import TaxonomyEntityForm from './TaxonomyEntityForm.jsx';
import TaxonomyBulkWorkspace from './TaxonomyBulkWorkspace.jsx';
import {
  createInstructionTaxonomyEntity,
  deleteInstructionTaxonomyEntity,
  fetchInstructionTaxonomyRegistry,
  fetchInstructionTaxonomyUsage,
  updateInstructionTaxonomyEntity,
} from './instructionTaxonomyApi.js';
import {
  TAXONOMY_GROUPS,
  entitiesFor,
  entityToForm,
  formToInput,
  newEntityForm,
  validateTaxonomyForm,
} from './taxonomyForm.js';
import styles from './AdminInstructionTaxonomy.module.css';
import bulkStyles from './TaxonomyBulkWorkspace.module.css';

function editEntity(entity, revision) {
  const form = entityToForm(entity);
  return {
    kind: entity.kind,
    code: entity.code,
    source: entity.source,
    revision,
    initial: JSON.stringify(form),
    form,
  };
}

export default function AdminInstructionTaxonomy({ token, hidden = false }) {
  const [registry, setRegistry] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState('metadata');
  const [bulkRequest, setBulkRequest] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [kind, setKind] = useState('root');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('order');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState('');
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState('');
  const [usageAttempt, setUsageAttempt] = useState(0);
  const startedRef = useRef(false);
  const busyRef = useRef(false);
  const dirty = Boolean(editor && JSON.stringify(editor.form) !== editor.initial);
  const selectedKind = editor?.kind;
  const selectedCode = editor?.code;
  const selectedRevision = editor?.revision;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchInstructionTaxonomyRegistry(token);
      setRegistry(data.registry);
      setEditor(editEntity(data.registry.root, data.registry.revision));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hidden && !startedRef.current) {
      startedRef.current = true;
      loadInitial();
    }
  }, [hidden, loadInitial]);

  useEffect(() => {
    if (!dirty) return undefined;
    function preventUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);

  useEffect(() => {
    if (!selectedCode) return undefined;
    let cancelled = false;
    fetchInstructionTaxonomyUsage(token, selectedKind, selectedCode)
      .then(data => {
        if (!cancelled) setUsage(data.usage);
      })
      .catch(loadError => {
        if (!cancelled) setUsageError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedKind, selectedCode, selectedRevision, usageAttempt]);

  function confirmDiscard() {
    return !dirty || window.confirm('Отменить несохранённые изменения в форме?');
  }

  function changeWorkspaceMode(nextMode) {
    if (busyRef.current || bulkBusy) return;
    setWorkspaceMode(nextMode);
    if (nextMode === 'metadata' && selectedCode) {
      setUsage(null);
      setUsageError('');
      setUsageAttempt(value => value + 1);
    }
  }

  function showRelated(entityKind, code, targetSectionId) {
    setBulkRequest(current => ({
      kind: entityKind,
      code,
      targetSectionId,
      sequence: (current?.sequence || 0) + 1,
    }));
    setWorkspaceMode('bindings');
  }

  function clearFeedback() {
    setError('');
    setConflict(false);
    setMessage('');
    setUsage(null);
    setUsageError('');
  }

  function openEntity(entity) {
    if (busyRef.current || !confirmDiscard()) return;
    clearFeedback();
    setEditor(editEntity(entity, registry.revision));
    setUsageAttempt(current => current + 1);
  }

  function changeGroup(nextKind) {
    if (busyRef.current || !confirmDiscard()) return;
    clearFeedback();
    setKind(nextKind);
    setSearch('');
    const first = entitiesFor(registry, nextKind)[0];
    setEditor(first ? editEntity(first, registry.revision) : null);
  }

  function create() {
    if (busyRef.current || !confirmDiscard()) return;
    clearFeedback();
    const form = newEntityForm(kind, registry);
    setEditor({
      kind,
      code: null,
      revision: registry.revision,
      initial: JSON.stringify(form),
      form,
    });
  }

  async function reload() {
    if (busyRef.current || !confirmDiscard()) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await fetchInstructionTaxonomyRegistry(token);
      const latest = entitiesFor(data.registry, kind).find(item => item.code === editor?.code);
      setRegistry(data.registry);
      setEditor(latest ? editEntity(latest, data.registry.revision) : null);
      setUsage(null);
      setUsageError('');
      setUsageAttempt(current => current + 1);
      setConflict(false);
      setMessage('Сохранённые данные загружены.');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function reportError(actionError) {
    setError(actionError.message);
    setConflict(actionError.status === 409);
  }

  async function save(event) {
    event.preventDefault();
    if (busyRef.current || !editor) return;
    const validation = validateTaxonomyForm(editor.form);
    if (validation) {
      setError(validation);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const input = formToInput(editor.form, !editor.code);
      const data = editor.code
        ? await updateInstructionTaxonomyEntity(
            token,
            editor.kind,
            editor.code,
            input,
            editor.revision,
          )
        : await createInstructionTaxonomyEntity(token, editor.kind, input, editor.revision);
      const savedCode = editor.code || editor.form.code.trim();
      const saved = entitiesFor(data.registry, editor.kind).find(item => item.code === savedCode);
      setRegistry(data.registry);
      setEditor(editEntity(saved, data.registry.revision));
      setUsage(null);
      setUsageError('');
      setConflict(false);
      setMessage('Изменения сохранены.');
    } catch (saveError) {
      reportError(saveError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (busyRef.current || !editor?.code || !confirmDiscard()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const checked = await fetchInstructionTaxonomyUsage(token, editor.kind, editor.code);
      setUsage(checked.usage);
      const children =
        editor.kind === 'catalog'
          ? registry.sections.filter(item => item.parentCode === editor.code)
          : [];
      if (checked.usage.references || children.length) {
        setError(
          `Удаление недоступно: связанных инструкций — ${checked.usage.references}, разделов — ${children.length}. Сначала перенесите их.`,
        );
        return;
      }
      if (!window.confirm(`Удалить пустой элемент «${editor.form.name}» (${editor.code})?`)) return;
      const data = await deleteInstructionTaxonomyEntity(
        token,
        editor.kind,
        editor.code,
        editor.revision,
      );
      setRegistry(data.registry);
      setEditor(null);
      setConflict(false);
      setMessage('Пустой элемент удалён.');
    } catch (deleteError) {
      reportError(deleteError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const query = search.trim().toLocaleLowerCase('ru');
  const items = entitiesFor(registry, kind)
    .filter(item => !query || `${item.code} ${item.name}`.toLocaleLowerCase('ru').includes(query))
    .sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name, 'ru');
      if (sort === 'code') return left.code.localeCompare(right.code, 'ru', { numeric: true });
      if (sort === 'status')
        return left.status.localeCompare(right.status) || left.name.localeCompare(right.name, 'ru');
      return (
        left.sortOrder - right.sortOrder ||
        left.code.localeCompare(right.code, 'ru', { numeric: true })
      );
    });

  return (
    <section hidden={hidden} className={styles.panel} data-boykov-admin-tab-section="taxonomy">
      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Справочники</div>
          <h2>Структура каталога</h2>
          <p>
            Управление каталогами, разделами, тегами и назначениями инструкций. Массовые изменения
            применяются после предпросмотра; история и откат доступны в журнале операций.
          </p>
        </div>
        {registry && workspaceMode === 'metadata' && (
          <button
            className={styles.button}
            type="button"
            disabled={busy || loading}
            onClick={reload}
          >
            Загрузить сохранённые данные
          </button>
        )}
      </div>
      <nav className={bulkStyles.modes} aria-label="Управление структурой каталога">
        {[
          { id: 'metadata', label: 'Справочники' },
          { id: 'bindings', label: 'Привязки инструкций' },
          { id: 'import', label: 'Импорт CSV' },
          { id: 'history', label: 'Журнал операций' },
        ].map(mode => (
          <button
            className={`${styles.button} ${workspaceMode === mode.id ? styles.primary : ''}`}
            key={mode.id}
            type="button"
            aria-pressed={workspaceMode === mode.id}
            disabled={busy || bulkBusy || loading}
            onClick={() => changeWorkspaceMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </nav>
      <div hidden={workspaceMode !== 'metadata'}>
        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            {conflict && (
              <p>
                Данные изменились в другой сессии или сейчас заняты. Ваша форма сохранена на экране.
                Загрузка сохранённых данных заменит её после подтверждения.
              </p>
            )}
            {!registry && (
              <button
                className={styles.button}
                type="button"
                disabled={loading}
                onClick={loadInitial}
              >
                Повторить загрузку
              </button>
            )}
          </div>
        )}
        {message && (
          <p className={styles.success} role="status">
            {message}
          </p>
        )}
        {loading && <p role="status">Загрузка структуры…</p>}
        {registry && (
          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Элементы структуры">
              <label className={styles.label}>
                Тип элемента
                <select
                  className={styles.input}
                  value={kind}
                  disabled={busy || loading}
                  onChange={event => changeGroup(event.target.value)}
                >
                  {TAXONOMY_GROUPS.map(group => (
                    <option key={group.kind} value={group.kind}>
                      {group.label} ({entitiesFor(registry, group.kind).length})
                    </option>
                  ))}
                </select>
              </label>
              {kind !== 'root' && (
                <button
                  className={styles.button}
                  type="button"
                  disabled={busy || loading || (kind === 'section' && !registry.catalogs.length)}
                  onClick={create}
                >
                  Добавить
                </button>
              )}
              <label className={styles.label}>
                Найти по коду или названию
                <input
                  className={styles.input}
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </label>
              <label className={styles.label}>
                Сортировка
                <select
                  className={styles.input}
                  value={sort}
                  onChange={event => setSort(event.target.value)}
                >
                  <option value="order">По порядку</option>
                  <option value="code">По коду</option>
                  <option value="name">По названию</option>
                  <option value="status">По статусу</option>
                </select>
              </label>
              <ul className={styles.list}>
                {items.map(item => (
                  <li key={item.code}>
                    <button
                      className={styles.item}
                      type="button"
                      disabled={busy || loading}
                      aria-current={editor?.code === item.code ? 'true' : undefined}
                      onClick={() => openEntity(item)}
                    >
                      <span className={styles.itemCode}>{item.code}</span>
                      <span>{item.name}</span>
                      <span className={styles.itemMeta}>
                        {item.status === 'published' ? 'Опубликован' : 'Черновик'} ·{' '}
                        {item.indexingEnabled ? 'Индексация включена' : 'Без индексации'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!items.length && <p className={styles.muted}>Элементы не найдены.</p>}
            </aside>
            <div className={styles.editor}>
              {editor ? (
                <TaxonomyEntityForm
                  key={`${editor.kind}/${editor.code || 'new'}/${editor.revision}`}
                  editor={editor}
                  token={token}
                  active={!hidden && workspaceMode === 'metadata'}
                  registry={registry}
                  busy={busy || loading}
                  dirty={dirty}
                  usage={usage}
                  usageError={usageError}
                  onUsageRetry={() => {
                    setUsageError('');
                    setUsageAttempt(current => current + 1);
                  }}
                  onChange={form => setEditor(current => ({ ...current, form }))}
                  onSave={save}
                  onDelete={remove}
                  onShowRelated={showRelated}
                />
              ) : (
                <p className={styles.empty}>Выберите элемент из списка или добавьте новый.</p>
              )}
            </div>
          </div>
        )}
      </div>
      <TaxonomyBulkWorkspace
        token={token}
        hidden={hidden || workspaceMode === 'metadata'}
        view={workspaceMode}
        request={bulkRequest}
        onBusyChange={setBulkBusy}
        onChanged={() => {
          setUsage(null);
          setUsageError('');
          setUsageAttempt(value => value + 1);
        }}
      />
    </section>
  );
}
