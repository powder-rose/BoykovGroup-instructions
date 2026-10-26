import { useEffect, useState } from 'react';
import { getInstructionTaxonomyFilters } from '../api/instructionsApi.js';

export default function useInstructionTaxonomyFilters({ catalogId = '', category = '' } = {}) {
  const key = JSON.stringify([catalogId, category]);
  const [result, setResult] = useState({
    key: null,
    catalogId: null,
    options: { catalogs: [], categories: [], tags: [] },
    error: '',
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await getInstructionTaxonomyFilters({
          catalogId,
          category,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResult({
          key,
          catalogId,
          options: {
            catalogs: Array.isArray(data?.catalogs) ? data.catalogs : [],
            categories: Array.isArray(data?.categories) ? data.categories : [],
            tags: Array.isArray(data?.tags) ? data.tags : [],
          },
          error: '',
        });
      } catch {
        if (!controller.signal.aborted)
          setResult(previous => ({
            key,
            catalogId,
            options: {
              catalogs: previous.options.catalogs,
              categories: previous.catalogId === catalogId ? previous.options.categories : [],
              tags: [],
            },
            error: 'Фильтры временно недоступны. Попробуйте обновить страницу.',
          }));
      }
    }
    void load();
    return () => controller.abort();
  }, [catalogId, category, key]);

  const ready = result.key === key;
  return {
    options: ready
      ? result.options
      : {
          catalogs: result.options.catalogs,
          categories: result.catalogId === catalogId ? result.options.categories : [],
          tags: [],
        },
    error: ready ? result.error : '',
    loading: !ready,
  };
}
