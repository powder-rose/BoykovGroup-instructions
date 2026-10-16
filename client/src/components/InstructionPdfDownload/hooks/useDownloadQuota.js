import { useCallback, useEffect, useRef, useState } from 'react';

import { parseDownloadQuota } from '../../../lib/downloadQuota.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function useDownloadQuota(token, enabled, instructionId = '') {
  const key = `${token}:${instructionId}`;
  const [result, setResult] = useState({ token: null, quota: null, error: false });
  const activeTokenRef = useRef(null);
  const requestRef = useRef(null);

  const refreshQuota = useCallback(async () => {
    if (!enabled || !token || activeTokenRef.current !== key) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/instructions/download-quota${instructionId ? `?instructionId=${encodeURIComponent(instructionId)}` : ''}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error('Не удалось получить остаток скачиваний');
      const data = await response.json();
      const quota = parseDownloadQuota(data);
      if (!quota) throw new Error('Некорректный остаток скачиваний');
      if (!controller.signal.aborted)
        setResult({
          token: key,
          quota,
          purchaseId: typeof data.purchaseId === 'string' ? data.purchaseId : null,
          error: false,
        });
    } catch {
      if (!controller.signal.aborted)
        setResult({ token: key, quota: null, purchaseId: null, error: true });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [token, enabled, key, instructionId]);

  const updateQuota = useCallback(
    value => {
      const quota = parseDownloadQuota(value);
      if (!enabled || !token || activeTokenRef.current !== key || !quota) return;

      // A delayed initial read must not replace the newer balance from a PDF response.
      requestRef.current?.abort();
      requestRef.current = null;
      setResult(previous => ({
        token: key,
        quota,
        purchaseId: previous.token === key ? previous.purchaseId : null,
        error: false,
      }));
    },
    [token, enabled, key],
  );

  useEffect(() => {
    activeTokenRef.current = enabled ? key : null;
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
  }, [token, enabled, key, refreshQuota]);

  const isCurrentAccount = enabled && result.token === key;
  return {
    purchaseId: isCurrentAccount ? result.purchaseId : null,
    remaining: isCurrentAccount ? (result.quota?.remaining ?? null) : null,
    quotaError: isCurrentAccount && result.error,
    refreshQuota,
    updateQuota,
  };
}
