import { useState } from 'react';

export default function ArticlesList({ items, loading, busy, onOpen, onDelete }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const visible = items.filter(
    item =>
      (filter === 'all' || item.status === filter) &&
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <div className="admin-articles__filters">
        <div className="admin-articles__tabs" aria-label="Статус статей">
          {[
            ['all', 'Все'],
            ['published', 'Опубликованные'],
            ['draft', 'Черновики'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Поиск статей"
          placeholder="Найти статью…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      {loading ? (
        <p role="status">Загрузка статей…</p>
      ) : !visible.length ? (
        <div className="admin-articles__empty">
          {items.length
            ? 'По выбранным условиям статей нет.'
            : 'Статей пока нет. Создайте первую статью с инструкцией.'}
        </div>
      ) : (
        <div className="admin-articles__list">
          {visible.map(article => (
            <article className="admin-articles__item" key={article.id}>
              <div>
                <span className={`admin-articles__status is-${article.status}`}>
                  {article.status === 'published' ? 'Опубликована' : 'Черновик'}
                </span>
                <h3>{article.title || 'Без заголовка'}</h3>
                <p>{article.excerpt}</p>
                <small>
                  Обновлено:{' '}
                  {new Date(article.updatedAt || article.createdAt).toLocaleDateString('ru-RU')}
                </small>
              </div>
              <div className="admin-articles__item-actions">
                <button type="button" disabled={busy} onClick={() => onOpen(article.id)}>
                  Редактировать
                </button>
                {article.status === 'published' && (
                  <a href={`/stati/${article.slug}`} target="_blank" rel="noopener noreferrer">
                    Открыть на сайте ↗
                  </a>
                )}
                <button
                  type="button"
                  className="admin-articles__danger"
                  disabled={busy}
                  onClick={() => onDelete(article)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
