import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ArticleContent from '../../components/ArticleContent/ArticleContent.jsx';
import ArticleSeo from '../../components/ArticleContent/ArticleSeo.jsx';
import InstructionStickyHeader from '../../components/InstructionStickyHeader/InstructionStickyHeader.jsx';

import styles from './ArticlePage.module.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function PublicationDate({ value }) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <time className={styles.date} dateTime={value}>
      {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
    </time>
  );
}

export default function ArticlePage() {
  const { slug } = useParams();
  const [result, setResult] = useState({ slug: '', article: null, status: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setResult({ slug, article: null, status: 'loading' });

    async function loadArticle() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/articles/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setResult({ slug, article: null, status: 'not-found' });
          }

          return;
        }

        if (!response.ok) {
          throw new Error('Не удалось загрузить статью.');
        }

        const data = await response.json();

        if (!data.article || typeof data.article.title !== 'string') {
          throw new Error('Не удалось загрузить статью.');
        }

        if (!controller.signal.aborted) {
          setResult({ slug, article: data.article, status: 'ready' });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ slug, article: null, status: 'error' });
        }
      }
    }

    void loadArticle();

    return () => controller.abort();
  }, [slug, retry]);

  const status = result.slug === slug ? result.status : 'loading';
  const article = status === 'ready' ? result.article : null;

  return (
    <div className={styles.page}>
      <ArticleSeo
        title={
          article
            ? article.seoTitle || `${article.title} | БОЙКОВГРУПП`
            : status === 'not-found'
              ? 'Статья не найдена | БОЙКОВГРУПП'
              : 'Статьи | БОЙКОВГРУПП'
        }
        description={article?.seoDescription || article?.excerpt || 'Статьи по охране труда.'}
        path={`/stati/${encodeURIComponent(slug)}`}
        article={article}
        noindex={status === 'not-found' || status === 'error'}
      />
      <InstructionStickyHeader />

      <main className={styles.main}>
        <Link to="/stati" className={styles.back}>
          ← Все статьи
        </Link>

        {status === 'loading' && (
          <p className={styles.state} role="status">
            Загрузка статьи…
          </p>
        )}

        {status === 'not-found' && (
          <div className={styles.state}>
            <h1>Статья не найдена</h1>
            <p>Возможно, она ещё не опубликована или была удалена.</p>
            <Link to="/stati">Перейти к списку статей →</Link>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.state} role="alert">
            <h1>Не удалось загрузить статью</h1>
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" onClick={() => setRetry(value => value + 1)}>
              Повторить загрузку
            </button>
          </div>
        )}

        {article && (
          <article>
            <header className={styles.heading}>
              <PublicationDate value={article.publishedAt} />
              <h1>{article.title}</h1>
              {article.excerpt && <p className={styles.excerpt}>{article.excerpt}</p>}
            </header>

            <ArticleContent key={article.id} content={article.content} slug={article.slug} />
          </article>
        )}
      </main>
    </div>
  );
}
