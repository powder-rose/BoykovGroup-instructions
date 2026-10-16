import { useCallback, useEffect, useRef, useState } from 'react';

import { parseDownloadQuota } from '../../../lib/downloadQuota.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function useDownloadQuota(token, enabled) {
  const [result, setResult] = useState({ token: null, quota: null, error: false });
  const activeTokenRef = useRef(null);
  const requestRef = useRef(null);

  const refreshQuota = useCallback(async () => {
    if (!enabled || !token || activeTokenRef.current !== token) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/api/instructions/download-quota`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Не удалось получить остаток скачиваний');
      const quota = parseDownloadQuota(await response.json());
      if (!quota) throw new Error('Некорректный остаток скачиваний');
      if (!controller.signal.aborted) setResult({ token, quota, error: false });
    } catch {
      if (!controller.signal.aborted) setResult({ token, quota: null, error: true });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [token, enabled]);

  const updateQuota = useCallback(
    value => {
      const quota = parseDownloadQuota(value);
      if (!enabled || !token || activeTokenRef.current !== token || !quota) return;

      // A delayed initial read must not replace the newer balance from a PDF response.
      requestRef.current?.abort();
      requestRef.current = null;
      setResult({ token, quota, error: false });
    },
    [token, enabled],
  );

  useEffect(() => {
    activeTokenRef.current = enabled ? token : null;
    if (!enabled || !token) return undefined;

    const onFocus = () => {
      void refreshQuota();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshQuota();
    };
    void refreshQuota();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      activeTokenRef.current = null;
      requestRef.current?.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, enabled, refreshQuota]);

  const isCurrentAccount = enabled && result.token === token;
  return {
    remaining: isCurrentAccount ? (result.quota?.remaining ?? null) : null,
    quotaError: isCurrentAccount && result.error,
    refreshQuota,
    updateQuota,
  };
}
