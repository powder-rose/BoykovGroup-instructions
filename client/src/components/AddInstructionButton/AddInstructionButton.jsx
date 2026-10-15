import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAdmin } from '../../store/authSlice.js';
import AddInstructionModal from './AddInstructionModal.jsx';
import styles from './AddInstructionButton.module.css';

/**
 * Кнопка «добавить инструкцию» в панели управления сверху — доступна
 * только админу. В отличие от GenerateInstructionButton (генерация через
 * YandexGPT), здесь инструкция берётся из собственного файла админа
 * (PDF/DOCX/TXT/MD) или вводится текстом вручную.
 */
export default function AddInstructionButton({ onImportCreated }) {
  const isAdmin = useSelector(selectIsAdmin);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
        <span className={styles.plus}>+</span>
        Импортировать инструкцию
      </button>

      {isModalOpen && (
        <AddInstructionModal
          onClose={() => setIsModalOpen(false)}

          onImportCreated={id => {
            onImportCreated(id);

            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
