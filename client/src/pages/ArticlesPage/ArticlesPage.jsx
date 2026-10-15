import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import InstructionStickyHeader from '../../components/InstructionStickyHeader/InstructionStickyHeader.jsx';
import ArticleSeo from '../../components/ArticleContent/ArticleSeo.jsx';

import styles from './ArticlesPage.module.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function formatDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ArticlesPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setItems(null);
    setError('');

    async function loadArticles() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/articles`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Не удалось загрузить статьи. Попробуйте ещё раз.');
        }

        const data = await response.json();

        if (!Array.isArray(data.items)) {
          throw new Error('Не удалось загрузить статьи. Попробуйте ещё раз.');
        }

        if (!controller.signal.aborted) {
          setItems(data.items);
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure.message || 'Не удалось загрузить статьи.');
        }
      }
    }

    void loadArticles();

    return () => controller.abort();
  }, [retry]);

  return (
    <div className={styles.page}>
      <ArticleSeo
        title="Статьи и инструкции по охране труда | БОЙКОВГРУПП"
        description="Статьи по охране труда с полными текстами инструкций и скачиванием PDF."
        path="/stati"
      />
      <InstructionStickyHeader />

      <main className={styles.main}>
        <Link to="/" className={styles.back}>
          ← На главную
        </Link>

        <div className={styles.heading}>
          <span className={styles.eyebrow}>База знаний</span>
          <h1>Статьи</h1>
          <p>Разъяснения по охране труда и инструкции, которые можно прочитать и скачать.</p>
        </div>

        {error ? (
          <div className={styles.state} role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry(value => value + 1)}>
              Повторить загрузку
            </button>
          </div>
        ) : !items ? (
          <p className={styles.state} role="status">
            Загрузка статей…
          </p>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            <h2>Готовим первые материалы</h2>
            <p>Скоро здесь появятся статьи с инструкциями. Пока можно воспользоваться каталогом.</p>
            <Link to="/instrukcii-po-ohrane-truda">Перейти к инструкциям →</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map(article => (
              <article className={styles.card} key={article.id}>
                {article.publishedAt && formatDate(article.publishedAt) && (
                  <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                )}
                <h2>
                  <Link to={`/stati/${encodeURIComponent(article.slug)}`}>{article.title}</Link>
                </h2>
                {article.excerpt && <p>{article.excerpt}</p>}
                <Link
                  className={styles.readLink}
                  to={`/stati/${encodeURIComponent(article.slug)}`}
                  aria-label={`Читать статью «${article.title}»`}
                >
                  Читать статью <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
