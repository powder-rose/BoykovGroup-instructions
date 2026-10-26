import { useEffect, useRef, useState } from 'react';

import { PAGE_SIZE } from '../../../constants.js';
import useInstructionTaxonomyFilters from '../../../hooks/useInstructionTaxonomyFilters.js';
import useInstructionCatalogFilters from '../../../hooks/useInstructionCatalogFilters.js';

export default function useInstructionsCatalog() {
  const {
    searchParams,
    setSearchParams,
    queryInput,
    setQueryInput,
    category,
    tag,
    catalogId,
    changeCategory,
    changeTag,
    changeCatalog,
    clearTaxonomy,
  } = useInstructionCatalogFilters();
  const query = queryInput.trim();
  const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'newest';
  const requestedPage = Number(searchParams.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const hasParameters = searchParams.size > 0;
  const previousFiltersRef = useRef({ queryInput, category, tag, catalogId, sort });
  const correctedPageRef = useRef(null);
  const {
    options: filterOptions,
    error: filterError,
    loading: filtersLoading,
  } = useInstructionTaxonomyFilters({ catalogId, category });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const requestKey = JSON.stringify([query, category, tag, catalogId, sort, page]);
    const alreadyLoaded = correctedPageRef.current === requestKey;
    correctedPageRef.current = null;
    if (alreadyLoaded) return;

    const controller = new AbortController();
    const previous = previousFiltersRef.current;
    const queryOnlyChanged =
      previous.queryInput !== queryInput &&
      previous.category === category &&
      previous.tag === tag &&
      previous.catalogId === catalogId &&
      previous.sort === sort;
    previousFiltersRef.current = { queryInput, category, tag, catalogId, sort };
    setLoading(true);
    setError('');

    async function load() {
      try {
        const params = new URLSearchParams({
          q: query,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sort,
        });
        if (category) params.set('category', category);
        if (tag) params.set('tag', tag);
        if (catalogId) params.set('catalog', catalogId);

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

        const actualPage = Number(data?.page);
        if (Number.isSafeInteger(actualPage) && actualPage > 0 && actualPage !== requestedPage) {
          // The response already contains this page; correcting its URL needs no second request.
          correctedPageRef.current = JSON.stringify([
            query,
            category,
            tag,
            catalogId,
            sort,
            actualPage,
          ]);
          setSearchParams(
            current => {
              const next = new URLSearchParams(current);
              if (actualPage === 1) next.delete('page');
              else next.set('page', String(actualPage));
              return next;
            },
            { replace: true },
          );
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError?.message || 'Не удалось загрузить инструкции.');
        setItems([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    const timeout = window.setTimeout(() => void load(), queryOnlyChanged ? 350 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, requestedPage, query, queryInput, sort, category, tag, catalogId, setSearchParams]);

  function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || loading) return;

    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (nextPage === 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    });
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
    catalogId,
    hasParameters,
    filterOptions,
    filterError,
    filtersLoading,
    changeCategory,
    changeTag,
    changeCatalog,
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
