import { useEffect, useState } from 'react';

export default function useAdminCommerceStats(token) {
  const [period, setPeriod] = useState('total');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    async function refresh(silent = false) {
      if (!silent) setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/commerce-stats?period=${encodeURIComponent(period)}`,
          {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Ошибка статистики (${response.status})`);
        if (controller.signal.aborted) return;
        setData(result);
        setError('');
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message || 'Не удалось загрузить статистику.');
        }
      } finally {
        if (!controller.signal.aborted && !silent) setLoading(false);
      }
    }

    void refresh();
    const onFocus = () => void refresh(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, period]);

  return { period, setPeriod, data, loading, error };
}
