import { useEffect, useState } from 'react';
import { fetchTaxonomyNavigation } from './taxonomyPagesApi.js';

export default function useTaxonomyNavigation() {
  const [navigation, setNavigation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchTaxonomyNavigation({ signal: controller.signal })
      .then(value => {
        if (!controller.signal.aborted) setNavigation(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Структура каталога временно недоступна.');
      });
    return () => controller.abort();
  }, []);

  return { navigation, error };
}
