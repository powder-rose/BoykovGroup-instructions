import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDispatch, useSelector } from 'react-redux';

import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import useInstructionTaxonomyFilters from '../../../hooks/useInstructionTaxonomyFilters.js';

import {
  deleteInstruction,
  generateInstruction,
  searchInstructions,
} from '../../../store/instructionsSlice.js';

import { selectIsAdmin } from '../../../store/authSlice.js';

import { PAGE_SIZE } from '../../../constants.js';

export default function useHomeInstructions() {
  const dispatch = useDispatch();

  const isAdmin = useSelector(selectIsAdmin);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryInput = searchParams.get('q') ?? '';
  const catalogId = searchParams.get('catalog') ?? '';
  const { options: filterOptions } = useInstructionTaxonomyFilters();

  function updateSearch(key, value, replace) {
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        return next;
      },
      { replace },
    );
  }

  function setQueryInput(value) {
    updateSearch('q', value, true);
  }

  function changeCatalog(value) {
    updateSearch('catalog', value, false);
  }

  const debouncedQuery = useDebouncedValue(queryInput, 350);

  const {
    items,
    total,
    page: resultPage,
    totalPages,

    isSearching,
    isLoadingMore,

    searchError,
    loadMoreError,

    isGenerating,
    generateError,

    deletingId,
  } = useSelector(state => state.instructions);

  useEffect(() => {
    dispatch(
      searchInstructions({
        query: debouncedQuery,
        catalogId,

        page: 1,

        pageSize: PAGE_SIZE,

        append: false,
      }),
    );
  }, [dispatch, debouncedQuery, catalogId]);

  async function generate() {
    if (!isAdmin) {
      return;
    }

    await dispatch(generateInstruction(debouncedQuery));
  }

  function remove(id) {
    if (!isAdmin) {
      return;
    }

    dispatch(deleteInstruction(id));
  }

  function refresh() {
    dispatch(
      searchInstructions({
        query: debouncedQuery,
        catalogId,

        page: 1,

        pageSize: PAGE_SIZE,
      }),
    );
  }

  const showEmptyState =
    !isSearching &&
    !searchError &&
    Boolean(debouncedQuery.trim() || catalogId) &&
    items.length === 0;

  return {
    queryInput,
    setQueryInput,
    debouncedQuery,
    catalogId,
    changeCatalog,
    filterOptions,

    isAdmin,

    items,
    total,
    resultPage,
    totalPages,

    isSearching,
    isLoadingMore,
    searchError,
    loadMoreError,

    isGenerating,
    generateError,
    deletingId,

    showEmptyState,

    generate,
    remove,
    refresh,
  };
}
