import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTaxonomyPage } from './taxonomyPagesApi.js';

export default function useTaxonomyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState({ key: '', status: 'loading', page: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${location.pathname}${location.search}`;
  const queryInput = searchParams.get('q') || '';

  useEffect(() => {
    const controller = new AbortController();
    setResult({ key, status: 'loading', page: null });
    const timeout = window.setTimeout(
      async () => {
        try {
          const page = await fetchTaxonomyPage(location.pathname, location.search, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (page.redirect) {
            if (page.redirect === key) throw new Error('Не удалось открыть адрес страницы.');
            navigate(page.redirect, { replace: true });
            return;
          }
          setResult({ key, status: 'ready', page });
        } catch (error) {
          if (!controller.signal.aborted) {
            setResult({ key, status: error.status === 404 ? 'not-found' : 'error', page: null });
          }
        }
      },
      queryInput ? 350 : 0,
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [key, location.pathname, location.search, navigate, queryInput, attempt]);

  function setQueryInput(value) {
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  const status = result.key === key ? result.status : 'loading';
  return {
    page: status === 'ready' ? result.page : null,
    status,
    queryInput,
    setQueryInput,
    retry: () => setAttempt(value => value + 1),
  };
}
