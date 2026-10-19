import { useEffect, useState } from 'react';
import { fetchInstructionTaxonomy } from './instructionEditorApi.js';

const TAG_TYPE_LABELS = {
  profession: 'Профессия',
  work: 'Вид работ',
  equipment: 'Оборудование',
};

export default function InstructionTaxonomyEditor({ token, record, form, onCategory, onTags }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchInstructionTaxonomy(token)
      .then(value => {
        if (cancelled) return;
        setCatalog(value);
        setError('');
      })
      .catch(reason => {
        if (!cancelled) setError(reason.message || 'Не удалось загрузить справочник');
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  const categoryMode =
    form.taxonomyPatch?.category?.mode ||
    (record?.taxonomyMeta?.categorySource === 'manual' ? 'manual' : 'auto');
  const tagsMode =
    form.taxonomyPatch?.tags?.mode ||
    (record?.taxonomyMeta?.tagsSource === 'manual' ? 'manual' : 'auto');
  const selectedIds = Array.isArray(form.tagIds) ? form.tagIds : [];
  const tags = catalog?.tags || [];
  const byId = new Map(tags.map(tag => [tag.id, tag]));
  const matched = query.trim()
    ? tags
        .filter(tag =>
          tag.label.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')),
        )
        .slice(0, 24)
    : [];

  function toggleTag(id) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(item => item !== id)
      : [...selectedIds, id];
    if (next.length <= 5) onTags(next, 'manual');
  }

  return (
    <section className="admin-instruction-taxonomy" aria-labelledby="instruction-taxonomy-heading">
      <div className="admin-instruction-taxonomy__header">
        <div>
          <h3 id="instruction-taxonomy-heading">Категория и теги</h3>
          <p>
            По умолчанию определяются автоматически. Ручной выбор сохраняется при обновлении
            инструкции.
          </p>
        </div>
      </div>
      {error ? (
        <p className="admin-instructions__error" role="alert">
          Не удалось загрузить справочник: {error}{' '}
          <button type="button" onClick={() => setRetry(value => value + 1)}>
            Повторить
          </button>
        </p>
      ) : !catalog ? (
        <p className="admin-instruction-taxonomy__hint" role="status">
          Загружаем категории и теги…
        </p>
      ) : (
        <>
          <div className="admin-instruction-taxonomy__group">
            <div className="admin-instruction-taxonomy__row">
              <span className="admin-instruction-taxonomy__label">Основная категория</span>
              <span className="admin-instruction-taxonomy__status">
                {categoryMode === 'manual' ? 'Выбрана вручную' : 'Автоматический подбор'}
              </span>
            </div>
            <select
              aria-label="Основная категория инструкции"
              value={form.primaryCategoryId || ''}
              onChange={event => onCategory(event.target.value || null, 'manual')}
            >
              <option value="">Не выбрана</option>
              {catalog.categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <div className="admin-instruction-taxonomy__foot">
              <small>
                {categoryMode === 'auto'
                  ? 'При сохранении система определит категорию по названию и профессии.'
                  : 'Ручная категория не будет изменена автоматической обработкой.'}
              </small>
              {categoryMode === 'manual' && (
                <button type="button" onClick={() => onCategory(null, 'auto')}>
                  Вернуть автоподбор
                </button>
              )}
            </div>
          </div>
          <div className="admin-instruction-taxonomy__group">
            <div className="admin-instruction-taxonomy__row">
              <span className="admin-instruction-taxonomy__label">Теги</span>
              <span className="admin-instruction-taxonomy__status">
                {tagsMode === 'manual' ? 'Выбраны вручную' : 'Автоматический подбор'}
              </span>
            </div>
            <div className="admin-instruction-taxonomy__selected" aria-live="polite">
              {selectedIds.length ? (
                selectedIds.map(id => (
                  <button
                    type="button"
                    className="admin-instruction-taxonomy__chip"
                    key={id}
                    onClick={() => toggleTag(id)}
                    title="Убрать тег"
                    aria-label={`Убрать тег ${byId.get(id)?.label || id}`}
                  >
                    {byId.get(id)?.label || id} <span aria-hidden="true">×</span>
                  </button>
                ))
              ) : (
                <span className="admin-instruction-taxonomy__hint">Теги пока не выбраны</span>
              )}
            </div>
            <label className="admin-instruction-taxonomy__search">
              Найти тег ({selectedIds.length}/5)
              <input
                type="search"
                value={query}
                placeholder="Например, слесарь, сварка, погрузчик"
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            {query.trim() && (
              <div className="admin-instruction-taxonomy__results" aria-label="Найденные теги">
                {matched.length ? (
                  matched.map(tag => (
                    <button
                      type="button"
                      className="admin-instruction-taxonomy__option"
                      key={tag.id}
                      aria-pressed={selectedIds.includes(tag.id)}
                      disabled={!selectedIds.includes(tag.id) && selectedIds.length >= 5}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span>{tag.label}</span>
                      <small>{TAG_TYPE_LABELS[tag.type]}</small>
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
                {tagsMode === 'auto'
                  ? 'При сохранении будут подобраны до пяти тегов.'
                  : 'Выбранные вручную теги сохранятся при последующих обновлениях.'}
              </small>
              {tagsMode === 'manual' && (
                <button type="button" onClick={() => onTags([], 'auto')}>
                  Вернуть автоподбор
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
