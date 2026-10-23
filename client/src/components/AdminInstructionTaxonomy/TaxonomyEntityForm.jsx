import RichTextEditor from '../RichTextEditor/RichTextEditor.jsx';
import { entityPath } from './taxonomyForm.js';
import styles from './AdminInstructionTaxonomy.module.css';

export default function TaxonomyEntityForm({
  editor,
  registry,
  busy,
  dirty,
  usage,
  usageError,
  onUsageRetry,
  onChange,
  onSave,
  onDelete,
}) {
  const { kind, code, form, source } = editor;
  const creating = !code;
  const catalog =
    kind === 'catalog'
      ? registry.catalogs.find(item => item.code === code)
      : registry.catalogs.find(item => item.code === form.parentCode);
  const routePending =
    (kind === 'catalog' && (creating || catalog?.routeApproved === false)) ||
    (kind === 'section' && catalog?.routeApproved === false);
  const children =
    kind === 'catalog' ? registry.sections.filter(item => item.parentCode === code) : [];
  const inUse = Boolean(usage?.references || children.length);
  const path = entityPath(registry, kind, form);
  const change = (field, value) => onChange({ ...form, [field]: value });

  return (
    <form className={styles.form} onSubmit={onSave}>
      <div className={styles.formHead}>
        <h3>{creating ? 'Новый элемент' : form.name || code}</h3>
        <span className={styles.muted} role="status">
          {dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}
        </span>
      </div>
      {routePending && (
        <p className={styles.notice}>
          {catalog?.code === 'H01'
            ? 'В ТЗ и SEO-реестре указаны разные URL каталога профессий. До согласования адреса каталог и его разделы доступны только как черновики.'
            : 'URL этого каталога требует отдельного согласования. Каталог и его разделы можно редактировать как черновики; публикация пока недоступна.'}
        </p>
      )}
      <fieldset className={styles.fields} disabled={busy}>
        <div className={styles.fieldGrid}>
          <label className={styles.label}>
            Код *
            <input
              className={styles.input}
              value={form.code}
              maxLength={64}
              readOnly={!creating}
              required
              onChange={event => change('code', event.target.value)}
            />
            <small>Постоянный технический код. После создания изменить его нельзя.</small>
          </label>
          <label className={styles.label}>
            Название *
            <input
              className={styles.input}
              value={form.name}
              maxLength={250}
              required
              onChange={event => change('name', event.target.value)}
            />
          </label>
          {kind === 'section' && (
            <label className={styles.label}>
              Каталог *
              <select
                className={styles.input}
                value={form.parentCode}
                required
                onChange={event => change('parentCode', event.target.value)}
              >
                <option value="">Выберите каталог</option>
                {registry.catalogs.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.label}>
            URL (slug) *
            <input
              className={styles.input}
              value={form.slug}
              maxLength={160}
              readOnly={kind === 'root' || (kind === 'catalog' && !creating && routePending)}
              required
              onChange={event => change('slug', event.target.value)}
            />
            {path && <small className={styles.path}>{path}</small>}
          </label>
          <label className={styles.label}>
            Порядок сортировки
            <input
              className={styles.input}
              type="number"
              min="0"
              step="1"
              required
              value={form.sortOrder}
              onChange={event => change('sortOrder', event.target.value)}
            />
          </label>
          <label className={styles.label}>
            Статус
            <select
              className={styles.input}
              value={form.status}
              onChange={event => change('status', event.target.value)}
            >
              <option value="draft">Черновик</option>
              <option value="published" disabled={routePending}>
                Опубликован
              </option>
            </select>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={form.indexingEnabled}
              onChange={event => change('indexingEnabled', event.target.checked)}
            />
            Разрешить индексацию
          </label>
        </div>
        <p className={styles.muted}>
          Пустую страницу нельзя публиковать с индексацией. Новые разделы и теги сохраняются без
          индексации, пока вы её не включите.
        </p>
        <details className={styles.details} open>
          <summary>Заголовок и SEO</summary>
          <div className={styles.detailBody}>
            <label className={styles.label}>
              Заголовок страницы (H1)
              <input
                className={styles.input}
                value={form.h1}
                maxLength={250}
                onChange={event => change('h1', event.target.value)}
              />
            </label>
            <label className={styles.label}>
              SEO Title
              <input
                className={styles.input}
                value={form.seoTitle}
                maxLength={250}
                onChange={event => change('seoTitle', event.target.value)}
              />
            </label>
            <label className={styles.label}>
              SEO Description
              <textarea
                className={styles.input}
                rows={3}
                value={form.seoDescription}
                maxLength={500}
                onChange={event => change('seoDescription', event.target.value)}
              />
            </label>
            <label className={styles.label}>
              Canonical URL
              <input
                className={styles.input}
                type="url"
                value={form.canonicalUrl}
                maxLength={2048}
                onChange={event => change('canonicalUrl', event.target.value)}
              />
              <small>Необязательный полный адрес HTTP или HTTPS без параметров и якоря.</small>
            </label>
          </div>
        </details>
        <details className={styles.details}>
          <summary>Вступление</summary>
          <div className={styles.detailBody}>
            <RichTextEditor
              value={form.introContent}
              onChange={value => change('introContent', value)}
              disabled={busy}
              label="Вступление страницы каталога"
            />
          </div>
        </details>
        <details className={styles.details}>
          <summary>SEO-текст</summary>
          <div className={styles.detailBody}>
            <RichTextEditor
              value={form.seoContent}
              onChange={value => change('seoContent', value)}
              disabled={busy}
              label="SEO-текст страницы каталога"
            />
          </div>
        </details>
      </fieldset>
      {source && (
        <details className={styles.details}>
          <summary>Источник справочника</summary>
          <div className={styles.source}>
            {source.file && <p>Файл: {source.file}</p>}
            {source.sheet && (
              <p>
                Лист: {source.sheet}
                {source.row ? `, строка ${source.row}` : ''}
              </p>
            )}
            {source.originalUrl && <p>Исходный адрес: {source.originalUrl}</p>}
          </div>
        </details>
      )}
      {!creating && (
        <div className={styles.usage}>
          {usage ? (
            <p>
              Связанные инструкции: {usage.references}. Из них опубликованных:{' '}
              {usage.publishedInstructions}.
            </p>
          ) : usageError ? (
            <p role="alert">
              {usageError}{' '}
              <button
                className={styles.button}
                type="button"
                disabled={busy}
                onClick={onUsageRetry}
              >
                Повторить проверку
              </button>
            </p>
          ) : (
            <p role="status">Проверка связанных инструкций…</p>
          )}
          {children.length > 0 && <p>Разделов в каталоге: {children.length}.</p>}
          {inUse && kind !== 'root' && (
            <p>
              Для удаления сначала перенесите связанные инструкции или разделы. Перенос будет
              доступен на следующем этапе.
            </p>
          )}
        </div>
      )}
      <div className={styles.actions}>
        <button
          className={`${styles.button} ${styles.primary}`}
          type="submit"
          disabled={busy || (!dirty && !creating)}
        >
          {busy ? 'Подождите…' : 'Сохранить'}
        </button>
        {!creating && kind !== 'root' && (
          <button
            className={`${styles.button} ${styles.danger}`}
            type="button"
            disabled={busy || !usage || inUse}
            onClick={onDelete}
          >
            Удалить пустой элемент
          </button>
        )}
      </div>
    </form>
  );
}
