import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';
import { CSV_IMPORT_COUNT_LABELS } from './taxonomyImportReport.js';

export function taxonomyLabels(dictionary) {
  return {
    sections: new Map(
      [...(dictionary?.legacyCategories || []), ...(dictionary?.sections || [])].map(item => [
        item.id,
        item.label,
      ]),
    ),
    tags: new Map(
      [...(dictionary?.legacyTags || []), ...(dictionary?.tags || [])].map(item => [
        item.id,
        item.label,
      ]),
    ),
  };
}

export function assignmentLabel(id, labels) {
  return id ? `${id} · ${labels.get(id) || 'недоступное значение'}` : 'Не выбран';
}

export function AssignmentDetails({ assignment, labels }) {
  return (
    <div className={styles.assignment}>
      <span>Раздел: {assignmentLabel(assignment.primaryCategoryId, labels.sections)}</span>
      <span>
        Теги:{' '}
        {assignment.tagIds.length
          ? assignment.tagIds.map(id => assignmentLabel(id, labels.tags)).join('; ')
          : 'не выбраны'}
      </span>
    </div>
  );
}

export function versionLabel(version, index = 0, draftCount = 1) {
  if (version.version === 'published') return 'Опубликованная версия';
  return `Черновик${draftCount > 1 ? ` ${index + 1}` : ''}${version.revision ? ` · ревизия ${version.revision}` : ''}`;
}

export function operationLabel(action, labels) {
  if (!action) return 'Откат операции';
  if (action.type === 'rollback') return `Откат операции: ${action.operationId}`;
  if (action.type === 'assign-missing-tags')
    return 'Заполнить пустые теги опубликованных инструкций';
  if (action.type === 'import-csv') {
    return `Импорт CSV: ${action.fileName} · ${action.tagMode === 'replace' ? 'полная замена тегов' : 'добавление тегов'}`;
  }
  if (action.type === 'set-section')
    return `Назначить раздел: ${assignmentLabel(action.sectionId, labels.sections)}`;
  const prefix = action.type === 'add-tags' ? 'Добавить теги' : 'Снять теги';
  return `${prefix}: ${(action.tagIds || []).map(id => assignmentLabel(id, labels.tags)).join('; ')}`;
}

export function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '—' : date.toLocaleString('ru-RU');
}

export function OperationCounts({ counts }) {
  return (
    <dl className={styles.counts}>
      <div>
        <dt>Выбрано инструкций</dt>
        <dd>{counts.selectedDocuments}</dd>
      </div>
      <div>
        <dt>Инструкций с изменениями</dt>
        <dd>{counts.changedDocuments}</dd>
      </div>
      <div>
        <dt>Версий с изменениями</dt>
        <dd>{counts.changedVersions}</dd>
      </div>
      <div>
        <dt>Версий с новой ревизией</dt>
        <dd>{counts.updatedVersions}</dd>
      </div>
      <div>
        <dt>Без изменений</dt>
        <dd>{counts.unchangedDocuments}</dd>
      </div>
    </dl>
  );
}

export function CsvImportCounts({ counts }) {
  return (
    <dl className={styles.counts}>
      {CSV_IMPORT_COUNT_LABELS.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{counts[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BulkPagination({ page, pageSize, total, disabled, onPage, onPageSize, label }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={styles.pagination} aria-label={label}>
      <span className={base.muted}>
        Всего: {total}. Страница {page} из {pages}.
      </span>
      <div className={styles.inline}>
        {onPageSize && (
          <label className={styles.inline}>
            На странице
            <select
              className={base.input}
              value={pageSize}
              disabled={disabled}
              onChange={event => onPageSize(Number(event.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        )}
        <button
          className={base.button}
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Назад
        </button>
        <button
          className={base.button}
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
