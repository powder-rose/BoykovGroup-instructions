import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import { selectIsAdmin } from '../../store/authSlice.js';

import styles from './AutoGenerationToggle.module.css';

const TOKEN_STORAGE_KEY = 'boykovgroup_admin_token';

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export default function AutoGenerationToggle() {
  const isAdmin = useSelector(selectIsAdmin);

  const [enabled, setEnabled] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch('/api/instructions/auto-generation', {
          headers: {
            ...getAuthHeaders(),
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || 'Не удалось получить состояние автогенерации');
        }

        if (!cancelled) {
          setEnabled(data.enabled === true);

          setError('');
        }
      } catch (error) {
        if (!cancelled) {
          setError(error.message);
        }
      }
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleToggle() {
    if (loading || enabled === null) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/instructions/auto-generation', {
        method: 'PATCH',

        headers: {
          'Content-Type': 'application/json',

          ...getAuthHeaders(),
        },

        body: JSON.stringify({
          enabled: !enabled,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось изменить состояние автогенерации');
      }

      setEnabled(data.enabled === true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={enabled ? styles.stopButton : styles.startButton}
        disabled={loading || enabled === null}
        onClick={handleToggle}
      >
        <span
          className={enabled ? styles.statusEnabled : styles.statusDisabled}
          aria-hidden="true"
        />

        {enabled === null
          ? 'проверка автогенерации'
          : enabled
            ? 'остановить автогенерацию'
            : 'запустить автогенерацию'}
      </button>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
