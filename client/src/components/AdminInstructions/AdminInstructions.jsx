import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../../store/authSlice.js';
import { fetchEditorInstructions, deleteEditorInstruction } from './instructionEditorApi.js';
import { getDraftKey, removeInstructionDraft } from './instructionForm.js';
import InstructionDraftsList from './InstructionDraftsList.jsx';
import InstructionEditor from './InstructionEditor.jsx';
import './AdminInstructions.css';

export default function AdminInstructions({ token, hidden = false, onRefresh }) {
  const user = useSelector(selectAuthUser);
  const identity = user?.id || user?.login || user?.email || 'admin';
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEditorInstructions(token);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hidden) reload();
  }, [hidden, reload]);
  function open(id) {
    setEditingId(id);
    setEditing(true);
    setError('');
    setMessage('');
  }
  async function remove(instruction) {
    if (!window.confirm(`Удалить инструкцию «${instruction.title}» вместе с черновиком?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteEditorInstruction(token, instruction);
      removeInstructionDraft(getDraftKey(identity, instruction.id));
      setItems(current => current.filter(item => item.id !== instruction.id));
      setMessage('Инструкция удалена.');
      onRefresh?.();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      hidden={hidden}
      className="admin-instructions"
      data-boykov-admin-tab-section="instructions"
    >
      <div className="admin-instructions__head">
        <div>
          <div className="admin-instructions__eyebrow">Редактор</div>
          <h2>Инструкции</h2>
          <p>Создание, редактирование и черновики инструкций из каталога.</p>
        </div>
        {!editing && (
          <button
            type="button"
            className="admin-instructions__primary"
            disabled={busy}
            onClick={() => open(null)}
          >
            Создать инструкцию
          </button>
        )}
      </div>
      {error && (
        <div className="admin-instructions__error" role="alert">
          {error}
          <button type="button" onClick={reload} disabled={loading}>
            Повторить загрузку
          </button>
        </div>
      )}
      {message && (
        <p className="admin-instructions__success" role="status">
          {message}
        </p>
      )}
      {editing ? (
        <InstructionEditor
          key={editingId || 'new'}
          instructionId={editingId}
          token={token}
          onClose={() => {
            setEditing(false);
            reload();
          }}
          onChanged={reload}
          onSaved={() => onRefresh?.()}
        />
      ) : (
        <InstructionDraftsList
          items={items}
          loading={loading}
          busy={busy}
          onOpen={open}
          onDelete={remove}
        />
      )}
    </section>
  );
}
