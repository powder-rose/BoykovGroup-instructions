import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uploadInstruction } from "../../store/instructionsSlice.js";
import styles from "./AddInstructionButton.module.css";

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.md";

/** Модальная форма для добавления собственной инструкции — файлом или текстом (панель админа). */
export default function AddInstructionModal({ onClose }) {
  const dispatch = useDispatch();
  const isUploading = useSelector((state) => state.instructions.isUploading);
  const uploadError = useSelector((state) => state.instructions.uploadError);

  const [mode, setMode] = useState("file"); // "file" | "text"
  const [title, setTitle] = useState("");
  const [profession, setProfession] = useState("");
  const [manualText, setManualText] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isReady =
    title.trim() && profession.trim() && (mode === "file" ? Boolean(file) : manualText.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isReady) return;

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("profession", profession.trim());
    if (mode === "file") {
      formData.append("file", file);
    } else {
      formData.append("content", manualText.trim());
    }

    const result = await dispatch(uploadInstruction(formData));
    if (result) onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <span className={styles.eyebrow}>// своя_инструкция</span>
        <h2 className={styles.title}>Добавить свою инструкцию</h2>
        <p className={styles.hint}>
          Загрузите готовый файл (PDF, DOCX, TXT, MD) — текст извлечётся автоматически,
          либо вставьте текст вручную. Инструкция сразу появится в базе рядом со сгенерированными.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Название инструкции</span>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Инструкция по охране труда для кладовщика"
              autoFocus
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Профессия / категория</span>
            <input
              className={styles.input}
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="Например: кладовщик"
              required
            />
          </label>

          <div className={styles.modeSwitch} role="tablist" aria-label="Способ добавления">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "file"}
              className={mode === "file" ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode("file")}
            >
              Файл
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "text"}
              className={mode === "text" ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode("text")}
            >
              Текст вручную
            </button>
          </div>

          {mode === "file" ? (
            <label className={styles.field}>
              <span className={styles.label}>Файл (PDF / DOCX / TXT / MD)</span>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className={styles.fileHint}>
                Старый формат .doc (не .docx) сервер не распознаёт — пересохраните файл в .docx или
                .pdf, либо переключитесь на вкладку «Текст вручную».
              </span>
            </label>
          ) : (
            <label className={styles.field}>
              <span className={styles.label}>Текст инструкции</span>
              <textarea
                className={styles.textarea}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Вставьте или напишите текст инструкции. Пустая строка между абзацами — разделитель абзацев."
                rows={8}
              />
            </label>
          )}

          {uploadError && <p className={styles.error}>{uploadError}</p>}

          <button type="submit" className={styles.submit} disabled={isUploading || !isReady}>
            {isUploading ? "Добавляем..." : "Добавить инструкцию"}
          </button>
        </form>
      </div>
    </div>
  );
}
