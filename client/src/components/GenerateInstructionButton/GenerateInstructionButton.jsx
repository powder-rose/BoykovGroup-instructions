import { useState } from "react";
import { useSelector } from "react-redux";
import { selectIsAdmin } from "../../store/authSlice.js";
import GenerateInstructionModal from "./GenerateInstructionModal.jsx";
import styles from "./GenerateInstructionButton.module.css";

/**
 * Кнопка «сгенерировать инструкцию» в панели управления сверху — доступна
 * только админу, не привязана к результатам поиска (в отличие от кнопки
 * в EmptyState, которая подставляет уже введённый поисковый запрос).
 */
export default function GenerateInstructionButton() {
  const isAdmin = useSelector(selectIsAdmin);
  const [isModalOpen, setModalOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button type="button" className={styles.generateBtn} onClick={() => setModalOpen(true)}>
        <span aria-hidden="true" className={styles.plus}>+</span> сгенерировать инструкцию
      </button>
      {isModalOpen && <GenerateInstructionModal onClose={() => setModalOpen(false)} />}
    </>
  );
}