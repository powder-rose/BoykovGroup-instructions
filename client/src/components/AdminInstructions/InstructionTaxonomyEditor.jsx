import { useEffect, useState } from 'react';
import { fetchInstructionAssignmentTaxonomy } from './instructionEditorApi.js';

export default function InstructionTaxonomyEditor({
  token,
  record,
  form,
  onCategory,
  onTags,
  onDictionary,
  onConfirmRevision,
  revisionConflict = false,
}) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchInstructionAssignmentTaxonomy(token)
      .then(value => {
        if (cancelled) return;
        setCatalog(value);
        onDictionary(value);
      })
      .catch(reason => {
        if (!cancelled) setError(reason.message || 'Не удалось загрузить справочник');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry, onDictionary]);

  const patch = form.taxonomyPatch || {};
  const categoryMode =
    patch.category?.mode || (record?.taxonomyMeta?.categorySource === 'manual' ? 'manual' : 'auto');
  const tagsMode =
    patch.tags?.mode || (record?.taxonomyMeta?.tagsSource === 'manual' ? 'manual' : 'auto');
  const hasTaxonomyChanges = Boolean(patch.category || patch.tags);
  const selectedIds = Array.isArray(form.tagIds) ? form.tagIds : [];
  const sections = catalog?.sections || [];
  const selectedSection = sections.find(section => section.id === form.primaryCategoryId);
  const legacyCategory = catalog?.legacyCategories.find(
    category => category.id === form.primaryCategoryId,
  );
  const derivedCatalog = catalog?.catalogs.find(item => item.id === selectedSection?.catalogId);
  const tags = catalog?.tags || [];
  const byId = new Map(tags.map(tag => [tag.id, tag]));
  const legacyById = new Map((catalog?.legacyTags || []).map(tag => [tag.id, tag]));
  const unknownIds = selectedIds.filter(id => !byId.has(id) && !legacyById.has(id));
  const unknownSection = Boolean(form.primaryCategoryId && !selectedSection && !legacyCategory);
  const staleRevision = Boolean(
    catalog && hasTaxonomyChanges && patch.registryRevision !== catalog.revision,
  );
  const canConfirmRevision = Boolean(
    catalog &&
    !unknownIds.length &&
    !unknownSection &&
    (!patch.category || selectedSection) &&
    (record?.id || selectedSection),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const matched = normalizedQuery
    ? tags
        .filter(tag =>
          `${tag.id} ${tag.label}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery),
        )
        .slice(0, 24)
    : [];

  function toggleTag(id) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(item => item !== id)
      : [...selectedIds, id];
    onTags(next, catalog.revision);
  }

  return (
    <section className="admin-instruction-taxonomy" aria-labelledby="instruction-taxonomy-heading">
      <div className="admin-instruction-taxonomy__header">
        <div>
          <h3 id="instruction-taxonomy-heading">Раздел и теги</h3>
          <p>
            Выберите один основной тематический раздел. Каталог определяется по разделу. Тегов может
            быть несколько; их можно не добавлять. Ручной выбор сохраняется при обновлении
            инструкции.
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>
          {loading ? 'Загрузка справочника…' : 'Обновить справочник'}
        </button>
      </div>
      {error && (
        <p className="admin-instructions__error" role="alert">
          Не удалось загрузить справочник: {error} Значения в форме сохранены.
        </p>
      )}
      {!catalog ? (
        <p className="admin-instruction-taxonomy__hint" role="status">
          {loading ? 'Загружаем разделы и теги…' : 'Повторите загрузку справочника кнопкой выше.'}
        </p>
      ) : (
        <>
          {(staleRevision || revisionConflict) && (
            <div className="admin-instructions__notice" role="alert">
              <p>
                Справочник изменился после вашего выбора. Обновите его, проверьте раздел и теги,
                затем подтвердите выбор. Обновление справочника само по себе не изменяет форму.
              </p>
              {staleRevision && (
                <button
                  type="button"
                  disabled={loading || !canConfirmRevision}
                  onClick={() => onConfirmRevision(catalog.revision)}
                >
                  Подтвердить выбор по обновлённому справочнику
                </button>
              )}
            </div>
          )}
          <div className="admin-instruction-taxonomy__group">
            <div className="admin-instruction-taxonomy__row">
              <span className="admin-instruction-taxonomy__label">
                Основной тематический раздел
              </span>
              <span className="admin-instruction-taxonomy__status">
                {selectedSection || categoryMode === 'manual'
                  ? 'Выбран вручную'
                  : record?.id
                    ? 'Сохранённый автоматический выбор'
                    : 'Выберите раздел'}
              </span>
            </div>
            <select
              aria-label="Основной тематический раздел инструкции"
              value={form.primaryCategoryId || ''}
              disabled={loading}
              onChange={event => onCategory(event.target.value, catalog.revision)}
            >
              <option value="" disabled>
                Выберите раздел
              </option>
              {legacyCategory && (
                <option value={legacyCategory.id} disabled>
                  {legacyCategory.label} — прежняя категория
                </option>
              )}
              {unknownSection && (
                <option value={form.primaryCategoryId} disabled>
                  {form.primaryCategoryId} — недоступный раздел
                </option>
              )}
              {catalog.catalogs.map(item => (
                <optgroup key={item.id} label={`${item.id} · ${item.label}`}>
                  {sections
                    .filter(section => section.catalogId === item.id)
                    .map(section => (
                      <option key={section.id} value={section.id}>
                        {section.id} · {section.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <label>
              Каталог (определяется по разделу)
              <input
                readOnly
                value={derivedCatalog ? `${derivedCatalog.id} · ${derivedCatalog.label}` : ''}
                placeholder="Выберите тематический раздел"
              />
            </label>
            {legacyCategory && (
              <p className="admin-instruction-taxonomy__hint">
                Прежняя категория сохранена. Выберите новый раздел для переноса этой инструкции;
                соответствие автоматически не определяется.
              </p>
            )}
            {unknownSection && (
              <p className="admin-instructions__error" role="alert">
                Раздел {form.primaryCategoryId} отсутствует в загруженном справочнике. Значение
                сохранено в форме. Выберите доступный раздел вручную.
              </p>
            )}
            <div className="admin-instruction-taxonomy__foot">
              <small>
                {!record?.id
                  ? 'Для новой инструкции основной раздел обязателен, в том числе при сохранении черновика.'
                  : 'Если раздел и теги не менять, сохранение текста не переносит инструкцию в новую структуру.'}
              </small>
            </div>
          </div>
          <div className="admin-instruction-taxonomy__group">
            <div className="admin-instruction-taxonomy__row">
              <span className="admin-instruction-taxonomy__label">Теги ({selectedIds.length})</span>
              <span className="admin-instruction-taxonomy__status">
                {patch.tags || tagsMode === 'manual' || selectedIds.some(id => byId.has(id))
                  ? 'Выбраны вручную'
                  : record?.id
                    ? 'Сохранённый автоматический выбор'
                    : 'Необязательные теги'}
              </span>
            </div>
            <div className="admin-instruction-taxonomy__selected" aria-live="polite">
              {selectedIds.length ? (
                selectedIds.map(id => {
                  const tag = byId.get(id);
                  const legacyTag = legacyById.get(id);
                  const label = tag
                    ? `${id} · ${tag.label}`
                    : legacyTag
                      ? `${legacyTag.label} — прежний тег (${id})`
                      : `${id} — недоступный тег`;
                  return (
                    <button
                      type="button"
                      className="admin-instruction-taxonomy__chip"
                      key={id}
                      disabled={loading}
                      onClick={() => toggleTag(id)}
                      title="Убрать тег"
                      aria-label={`Убрать тег ${label}`}
                    >
                      {label} <span aria-hidden="true">×</span>
                    </button>
                  );
                })
              ) : (
                <span className="admin-instruction-taxonomy__hint">Теги не выбраны</span>
              )}
            </div>
            {unknownIds.length > 0 && (
              <p className="admin-instructions__error" role="alert">
                Некоторые выбранные теги отсутствуют в справочнике: {unknownIds.join(', ')}.
                Значения сохранены в форме. Удалите или замените их вручную.
              </p>
            )}
            <label className="admin-instruction-taxonomy__search">
              Найти тег по коду или названию
              <input
                type="search"
                value={query}
                placeholder="Например, T47 или газовые баллоны"
                disabled={loading}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            {normalizedQuery && (
              <div className="admin-instruction-taxonomy__results" aria-label="Найденные теги">
                {matched.length ? (
                  matched.map(tag => (
                    <button
                      type="button"
                      className="admin-instruction-taxonomy__option"
                      key={tag.id}
                      aria-pressed={selectedIds.includes(tag.id)}
                      disabled={loading}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span>{tag.label}</span>
                      <small>{tag.id}</small>
                      <span aria-hidden="true">{selectedIds.includes(tag.id) ? '✓' : '+'}</span>
                    </button>
                  ))
                ) : (
                  <p className="admin-instruction-taxonomy__hint">Подходящих тегов нет.</p>
                )}
              </div>
            )}
            <div className="admin-instruction-taxonomy__foot">
              <small>
                Прежние теги сохраняются до вашего решения и не заменяются новыми по сходству
                названий. Снять все теги можно вручную.
              </small>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onTags([], catalog.revision)}
                >
                  Снять все теги
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
