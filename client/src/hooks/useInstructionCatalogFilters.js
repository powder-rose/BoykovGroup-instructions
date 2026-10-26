import { useSearchParams } from 'react-router-dom';
import { updateInstructionFilterParams } from '../components/InstructionCatalog/instructionFilterParams.js';

export default function useInstructionCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryInput = searchParams.get('q') ?? '';
  const catalogId = searchParams.get('catalog') ?? '';
  const category = searchParams.get('category') ?? '';
  const tag = searchParams.get('tag') ?? '';

  function updateFilters(updates, { replace = false } = {}) {
    setSearchParams(current => updateInstructionFilterParams(current, updates), { replace });
  }

  return {
    searchParams,
    setSearchParams,
    queryInput,
    catalogId,
    category,
    tag,
    setQueryInput: value => updateFilters({ q: value }, { replace: true }),
    changeCatalog: value => {
      if (!value || value !== catalogId) updateFilters({ catalog: value });
    },
    changeCategory: value => updateFilters({ category: value }),
    changeTag: value => updateFilters({ tag: value }),
    clearTaxonomy: () => updateFilters({ category: '', tag: '' }),
  };
}
