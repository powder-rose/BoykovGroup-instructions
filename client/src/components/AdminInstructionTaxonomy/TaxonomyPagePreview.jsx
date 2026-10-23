import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import TaxonomyPageContent from '../TaxonomyLandingPage/TaxonomyPageContent.jsx';
import { fetchInstructionTaxonomyPreview } from './instructionTaxonomyApi.js';
import adminStyles from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyPagePreview.module.css';

export default function TaxonomyPagePreview({ token, kind, code, dirty, busy, active }) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [params, setParams] = useState({ q: '', sort: 'title', page: 1 });
  const [result, setResult] = useState(null);
  const available = Boolean(token && code && !dirty && !busy && active);

  useEffect(() => {
    if (!available) setExpanded(false);
  }, [available]);

  useEffect(() => {
    setExpanded(false);
    setResult(null);
  }, [token, kind, code]);

  useEffect(() => {
    if (!available || !expanded) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    fetchInstructionTaxonomyPreview(token, kind, code, {
      ...params,
      signal: controller.signal,
    })
      .then(data => {
        if (!cancelled) setResult({ params, token, kind, code, page: data.page });
      })
      .catch(error => {
        if (!cancelled && error.name !== 'AbortError') {
          setResult({ params, token, kind, code, error: error.message });
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [available, expanded, token, kind, code, params]);

  const current =
    result?.params === params &&
    result.token === token &&
    result.kind === kind &&
    result.code === code
      ? result
      : null;
  const page = current?.page;

  function search() {
    setParams(currentParams => ({ ...currentParams, q: queryInput.trim(), page: 1 }));
  }

  function open() {
    setExpanded(currentExpanded => !currentExpanded);
    setResult(null);
    setQueryInput('');
    setParams({ q: '', sort: 'title', page: 1 });
  }

  return (
    <div className={styles.root}>
      <button
        className={adminStyles.button}
        type="button"
        disabled={!available}
        aria-expanded={available && expanded}
        aria-controls={panelId}
        onClick={open}
      >
        {expanded ? 'Закрыть предпросмотр' : 'Предпросмотр страницы'}
      </button>
      {(!code || dirty) && (
        <p className={adminStyles.muted}>
          Сначала сохраните изменения. Предпросмотр показывает сохранённую страницу.
        </p>
      )}
      {available && expanded && (
        <section id={panelId} className={styles.panel} aria-label="Предпросмотр страницы">
          <p className={adminStyles.notice}>
            Предпросмотр сохранённой страницы доступен только администратору и не публикует её.
          </p>
          <div className={styles.search} role="search" aria-label="Поиск в предпросмотре">
            <label className={adminStyles.label}>
              Найти инструкцию по названию
              <input
                className={adminStyles.input}
                type="search"
                value={queryInput}
                maxLength={200}
                onChange={event => setQueryInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    search();
                  }
                }}
              />
            </label>
            <button className={adminStyles.button} type="button" onClick={search}>
              Найти
            </button>
          </div>
          {!current && <p role="status">Загрузка предпросмотра…</p>}
          {current?.error && (
            <div className={adminStyles.error} role="alert">
              <p>{current.error}</p>
              <button
                className={adminStyles.button}
                type="button"
                onClick={() => setParams(currentParams => ({ ...currentParams, page: 1 }))}
              >
                Повторить с первой страницы
              </button>
            </div>
          )}
          {page && (
            <>
              <dl className={styles.metadata}>
                <dt>Статус</dt>
                <dd>{page.entityStatus === 'published' ? 'Опубликован' : 'Черновик'}</dd>
                <dt>Адрес</dt>
                <dd>{page.path || 'Маршрут не согласован'}</dd>
                <dt>Title</dt>
                <dd>{page.seo.title}</dd>
                <dt>Description</dt>
                <dd>{page.seo.description || 'Не заполнено'}</dd>
                <dt>Canonical</dt>
                <dd>{page.seo.canonicalUrl || 'Не сформирован'}</dd>
                <dt>Robots предпросмотра</dt>
                <dd>{page.seo.robots}</dd>
              </dl>
              {page.publicPath && (
                <p className={adminStyles.muted}>
                  <Link to={page.publicPath}>Открыть публичную страницу</Link>
                </p>
              )}
              <h1 className={styles.heading}>{page.h1}</h1>
              <TaxonomyPageContent
                page={page}
                isAdmin
                onSort={sort => setParams(currentParams => ({ ...currentParams, sort, page: 1 }))}
                onPage={nextPage =>
                  setParams(currentParams => ({ ...currentParams, page: nextPage }))
                }
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
