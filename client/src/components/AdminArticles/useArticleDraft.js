import { useCallback, useEffect, useState } from 'react';
import { readArticleDraft, removeArticleDraft } from './articleForm.js';

export default function useArticleDraft({ draftKey, form, revision, dirty, onRestore }) {
  const [savedDraft, setSavedDraft] = useState(() => readArticleDraft(draftKey));
  const [storageError, setStorageError] = useState('');

  const persistDraft = useCallback(() => {
    if (!dirty || savedDraft) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ form, revision, savedAt: new Date().toISOString() }),
      );
      setStorageError('');
    } catch {
      setStorageError('Не удалось сохранить локальный черновик. Сохраните статью кнопкой ниже.');
    }
  }, [draftKey, form, revision, dirty, savedDraft]);

  useEffect(() => {
    if (!dirty || savedDraft) return undefined;
    const timer = window.setTimeout(persistDraft, 300);
    return () => window.clearTimeout(timer);
  }, [dirty, savedDraft, persistDraft]);

  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = event => {
      persistDraft();
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = event => {
      const link = event.target.closest?.('a[href]');
      if (
        !link ||
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = new URL(link.href, window.location.href);
      if (
        target.origin === window.location.origin &&
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      )
        return;
      if (!window.confirm('В статье есть несохранённые изменения. Покинуть редактор?')) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        persistDraft();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', persistDraft);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', persistDraft);
      document.removeEventListener('click', guardLink, true);
    };
  }, [dirty, persistDraft]);

  function restoreDraft() {
    onRestore(savedDraft.form);
    setSavedDraft(null);
  }

  function discardDraft() {
    removeArticleDraft(draftKey);
    setSavedDraft(null);
  }

  return { savedDraft, storageError, restoreDraft, discardDraft, persistDraft };
}
