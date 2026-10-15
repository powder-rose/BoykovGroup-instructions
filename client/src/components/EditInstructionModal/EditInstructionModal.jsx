import { lazy, Suspense, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthToken } from '../../store/authSlice.js';
import './EditInstructionModal.css';

const InstructionEditor = lazy(() => import('../AdminInstructions/InstructionEditor.jsx'));

export default function EditInstructionModal({ instruction, onClose, onSaved }) {
  const token = useSelector(selectAuthToken);
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      focused?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="instruction-edit-dialog"
      aria-label="Редактирование инструкции"
      onCancel={event => {
        event.preventDefault();
        const closeButton = dialogRef.current.querySelector('[data-close-instruction-editor]');
        if (closeButton) closeButton.click();
        else onClose();
      }}
    >
      <Suspense fallback={<p role="status">Загрузка редактора…</p>}>
        <InstructionEditor
          instructionId={instruction.id}
          token={token}
          onClose={onClose}
          onSaved={onSaved}
        />
      </Suspense>
    </dialog>
  );
}
