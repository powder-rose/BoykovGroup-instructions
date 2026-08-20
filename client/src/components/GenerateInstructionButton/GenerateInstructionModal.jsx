import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateInstruction } from "../../store/instructionsSlice.js";
import styles from "./GenerateInstructionButton.module.css";

/** Модальная форма для ручной генерации инструкции по названию профессии (панель админа). */
export default function GenerateInstructionModal({ onClose }) {
  const dispatch = useDispatch();
  const isGenerating = useSelector((state) => state.instructions.isGenerating);
  const generateError = useSelector((state) => state.instructions.generateError);
  const [profession, setProfession] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profession.trim()) return;
    const result = await dispatch(generateInstruction(profession.trim()));
    if (result) onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <span className={styles.eyebrow}>// генерация_инструкции</span>
        <h2 className={styles.title}>Новая инструкция через YandexGPT</h2>
        <p className={styles.hint}>
          Укажите профессию — инструкция будет сгенерирована и сразу появится в базе.
          Если инструкция для такой профессии уже есть, откроется существующая.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Профессия</span>
            <input
              className={styles.input}
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="Например: сварщик"
              autoFocus
              required
            />
          </label>

          {generateError && <p className={styles.error}>{generateError}</p>}

          <button type="submit" className={styles.submit} disabled={isGenerating || !profession.trim()}>
            {isGenerating ? "Генерируем..." : "Сгенерировать"}
          </button>
        </form>
      </div>
    </div>
  );
}