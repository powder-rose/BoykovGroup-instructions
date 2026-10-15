import { useState } from 'react';

export default function InstructionDraftsList({ items, loading, busy, onOpen, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const visible = items.filter(
    item =>
      (filter === 'all' || (filter === 'draft' ? item.hasDraft : item.hasPublishedVersion)) &&
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <div className="admin-instructions__filters">
        <div className="admin-instructions__tabs" aria-label="Статус инструкций">
          {[
            ['all', 'Все'],
            ['published', 'Опубликованные'],
            ['draft', 'Черновики'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setLimit(50);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Поиск инструкций в редакторе"
          placeholder="Найти инструкцию…"
          value={search}
          onChange={event => {
            setSearch(event.target.value);
            setLimit(50);
          }}
        />
      </div>
      {loading ? (
        <p role="status">Загрузка инструкций…</p>
      ) : !visible.length ? (
        <div className="admin-instructions__empty">
          {items.length
            ? 'По выбранным условиям инструкций нет.'
            : 'Создайте инструкцию или откройте существующую кнопкой «Редактировать» в каталоге.'}
        </div>
      ) : (
        <div className="admin-instructions__list">
          {visible.slice(0, limit).map(instruction => (
            <article className="admin-instructions__item" key={instruction.id}>
              <div>
                <span
                  className={`admin-instructions__status is-${instruction.hasPublishedVersion ? 'published' : 'draft'}`}
                >
                  {instruction.hasPublishedVersion
                    ? `Опубликована${instruction.hasDraft ? ' · есть черновик' : ''}`
                    : 'Черновик'}
                </span>
                <h3>{instruction.title || 'Без заголовка'}</h3>
                {instruction.webIntro && <p>{instruction.webIntro}</p>}
                <small>
                  Обновлено:{' '}
                  {new Date(instruction.updatedAt || instruction.createdAt).toLocaleDateString(
                    'ru-RU',
                  )}
                </small>
              </div>
              <div className="admin-instructions__item-actions">
                <button type="button" disabled={busy} onClick={() => onOpen(instruction.id)}>
                  Редактировать
                </button>
                {instruction.hasPublishedVersion && (
                  <a
                    href={`/instrukciya-po-ohrane-truda/${encodeURIComponent(instruction.publicSlug || instruction.slug || instruction.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть на сайте ↗
                  </a>
                )}
                <button
                  type="button"
                  className="admin-instructions__danger"
                  disabled={busy}
                  onClick={() => onDelete(instruction)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && visible.length > limit && (
        <button type="button" onClick={() => setLimit(current => current + 50)}>
          Показать ещё инструкции ({visible.length - limit})
        </button>
      )}
    </>
  );
}
