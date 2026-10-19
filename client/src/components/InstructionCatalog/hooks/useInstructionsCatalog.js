import { useEffect, useState } from 'react';

import { PAGE_SIZE } from '../../../constants.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';

export default function useInstructionsCatalog() {
  const [queryInput, setQueryInputState] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  );
  const query = useDebouncedValue(queryInput, 350).trim();
  const [category, setCategory] = useState(
    () => new URLSearchParams(window.location.search).get('category') ?? '',
  );
  const [tag, setTag] = useState(
    () => new URLSearchParams(window.location.search).get('tag') ?? '',
  );
  const [filterOptions, setFilterOptions] = useState({ categories: [], tags: [] });
  const [filterError, setFilterError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const sort =
    new URLSearchParams(window.location.search).get('sort') === 'popular' ? 'popular' : 'newest';

  function setQueryInput(nextQuery) {
    setPage(1);
    setQueryInputState(nextQuery);
  }

  function changeCategory(nextCategory) {
    setPage(1);
    setCategory(nextCategory);
  }

  function changeTag(nextTag) {
    setPage(1);
    setTag(nextTag);
  }

  function clearTaxonomy() {
    setPage(1);
    setCategory('');
    setTag('');
  }

  // Keep search and filters in the address so sorting and deep links preserve them.
  useEffect(() => {
    const url = new URL(window.location.href);
    const previous = url.search;
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (category) url.searchParams.set('category', category);
    else url.searchParams.delete('category');
    if (tag) url.searchParams.set('tag', tag);
    else url.searchParams.delete('tag');
    if (url.search !== previous) {
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, [query, category, tag]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadFilterOptions() {
      try {
        const response = await fetch('/api/instructions/taxonomy-filters', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Не удалось загрузить категории и теги.');
        const data = await response.json();
        if (controller.signal.aborted) return;
        setFilterOptions({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          tags: Array.isArray(data?.tags) ? data.tags : [],
        });
      } catch {
        if (!controller.signal.aborted) setFilterError('Фильтры временно недоступны.');
      }
    }
    void loadFilterOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          q: query,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sort,
        });
        if (category) params.set('category', category);
        if (tag) params.set('tag', tag);

        const response = await fetch(`/api/instructions?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || 'Не удалось загрузить инструкции.');
        }

        if (controller.signal.aborted) return;

        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Math.max(0, Number(data?.total) || 0));
        setTotalPages(Math.max(1, Number(data?.totalPages) || 1));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError?.message || 'Не удалось загрузить инструкции.');
        setItems([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [page, query, sort, category, tag]);

  function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || loading) return;

    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const paginationItems = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const result = [1];
    if (page > 4) result.push('left');

    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);

    for (let current = start; current <= end; current += 1) result.push(current);

    if (page < totalPages - 3) result.push('right');
    result.push(totalPages);
    return result;
  })();

  return {
    queryInput,
    setQueryInput,
    query,
    category,
    tag,
    filterOptions,
    filterError,
    changeCategory,
    changeTag,
    clearTaxonomy,
    items,
    total,
    loading,
    page,
    totalPages,
    error,
    paginationItems,
    changePage,
  };
}
