import { useEffect, useState } from 'react';
import { getInstructionTaxonomyFilters } from '../api/instructionsApi.js';

export default function useInstructionTaxonomyFilters() {
  const [options, setOptions] = useState({ catalogs: [], categories: [], tags: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await getInstructionTaxonomyFilters({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setOptions({
          catalogs: Array.isArray(data?.catalogs) ? data.catalogs : [],
          categories: Array.isArray(data?.categories) ? data.categories : [],
          tags: Array.isArray(data?.tags) ? data.tags : [],
        });
      } catch {
        if (!controller.signal.aborted) setError('Фильтры временно недоступны.');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return { options, error };
}
