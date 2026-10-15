import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../../store/authSlice.js';
import { getInstructionHistory, rollbackInstruction } from '../../api/instructionsApi.js';
import {
  fetchEditorInstruction,
  saveEditorInstruction,
  discardEditorDraft,
  unpublishEditorInstruction,
} from './instructionEditorApi.js';
import { getDraftKey, removeInstructionDraft } from './instructionForm.js';
import InstructionForm from './InstructionForm.jsx';
import './AdminInstructions.css';

const EMPTY_ENVELOPE = {
  instruction: null,
  hasDraft: false,
  hasPublishedVersion: false,
  publicSlug: null,
};

export default function InstructionEditor({ instructionId, token, onClose, onChanged, onSaved }) {
  const user = useSelector(selectAuthUser);
  const identity = user?.id || user?.login || user?.email || 'admin';
  const [envelope, setEnvelope] = useState(EMPTY_ENVELOPE);
  const [loading, setLoading] = useState(Boolean(instructionId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState(null);
  const [reload, setReload] = useState(0);
  const record = envelope.instruction;

  useEffect(() => {
    if (!instructionId) {
      setEnvelope(EMPTY_ENVELOPE);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchEditorInstruction(token, instructionId)
      .then(data => {
        if (!cancelled) setEnvelope(data);
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instructionId, token, reload]);

  useEffect(() => {
    if (!record?.id || !envelope.hasPublishedVersion) {
      setHistory(null);
      return undefined;
    }
    let cancelled = false;
    getInstructionHistory(record.id, token)
      .then(data => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [record?.id, record?.revision, envelope.hasPublishedVersion, token]);

  function acceptSaved(data, text, notifyPublication) {
    removeInstructionDraft(getDraftKey(identity, record?.id));
    setEnvelope(data);
    setMessage(text);
    onChanged?.(data);
    if (notifyPublication) onSaved?.(data.instruction, data);
  }

  async function save(form) {
    setBusy(true);
    setMessage('');
    try {
      const data = await saveEditorInstruction(token, form, record);
      acceptSaved(
        data,
        form.status === 'published'
          ? 'Инструкция опубликована.'
          : envelope.hasPublishedVersion
            ? 'Черновик сохранён. Опубликованная версия не изменена.'
            : 'Черновик сохранён. Инструкция пока не опубликована.',
        form.status === 'published',
      );
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (
      !window.confirm(
        envelope.hasPublishedVersion
          ? 'Удалить серверный черновик? Опубликованная версия останется на сайте.'
          : 'Удалить этот серверный черновик? Инструкция ещё не опубликована.',
      )
    )
      return;
    setBusy(true);
    try {
      await discardEditorDraft(token, record);
      removeInstructionDraft(getDraftKey(identity, record.id));
      onChanged?.();
      if (!envelope.hasPublishedVersion) {
        onClose();
        return;
      }
      setEnvelope(await fetchEditorInstruction(token, record.id));
      setMessage('Черновик удалён. Открыта опубликованная версия.');
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (
      !window.confirm(
        'Снять инструкцию с публикации? Она сохранится как черновик и исчезнет из каталога.',
      )
    )
      return;
    setBusy(true);
    try {
      const data = await unpublishEditorInstruction(token, record);
      acceptSaved(data, 'Инструкция снята с публикации и сохранена как черновик.', true);
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (!window.confirm('Вернуть опубликованную инструкцию к предыдущей сохранённой версии?'))
      return;
    setBusy(true);
    try {
      await rollbackInstruction(record.id, token);
      const data = await fetchEditorInstruction(token, record.id);
      acceptSaved(data, 'Предыдущая версия восстановлена.', true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-instructions instruction-editor-container">
      {loading ? (
        <p role="status">Загрузка инструкции…</p>
      ) : error ? (
        <div className="admin-instructions__error" role="alert">
          {error}
          <button type="button" onClick={() => setReload(value => value + 1)}>
            Повторить
          </button>
          <button type="button" onClick={onClose}>
            Закрыть редактор
          </button>
        </div>
      ) : (
        <>
          {message && (
            <p className="admin-instructions__success" role="status">
              {message}
            </p>
          )}
          <InstructionForm
            key={record ? `${record.id}:${record.revision}` : 'new'}
            envelope={envelope}
            identity={identity}
            saving={busy}
            history={history}
            onSave={save}
            onClose={onClose}
            onDiscard={discard}
            onRollback={rollback}
            onUnpublish={unpublish}
          />
        </>
      )}
    </div>
  );
}
