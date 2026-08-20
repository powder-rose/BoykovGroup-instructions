import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { uploadInstruction } from "../../store/instructionsSlice.js";
import styles from "./AddInstructionButton.module.css";

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.txt,.md";

/**           ( ). */
export default function AddInstructionModal({ onClose }) {
  const dispatch = useDispatch();
  const isUploading = useSelector((state) => state.instructions.isUploading);
  const uploadError = useSelector((state) => state.instructions.uploadError);

  const [mode, setMode] = useState("file"); // "file" | "text"
  const [title, setTitle] = useState("");
  const [profession, setProfession] = useState("");
  const [manualText, setManualText] = useState("");
  const [file, setFile] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

 const isReady =
  mode === "file"
    ? files.length > 0
    : manualText.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isReady) return;

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("profession", profession.trim());
    if (mode === "file") {

  files.forEach((file) => {

    formData.append(
      "files",
      file
    );

  });

}
    } else {
      formData.append("content", manualText.trim());
    }

    const result = await dispatch(uploadInstruction(formData));
    if (result) onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="">
          
        </button>

        <span className={styles.eyebrow}>// _</span>
        <h2 className={styles.title}>  </h2>
        <p className={styles.hint}>
             (PDF, DOCX, TXT, MD)    ,
             .        .
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}> </span>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=":      "
              autoFocus
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}> / </span>
            <input
              className={styles.input}
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder=": "
              required
            />
          </label>

          <div className={styles.modeSwitch} role="tablist" aria-label=" ">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "file"}
              className={mode === "file" ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode("file")}
            >
              
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "text"}
              className={mode === "text" ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode("text")}
            >
               
            </button>
          </div>

          {mode === "file" ? (
            <label className={styles.field}>
              <span className={styles.label}> (PDF / DOCX / TXT / MD)</span>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                onChange={(e) =>
  setFiles(
    Array.from(e.target.files || [])
  )
}
              />
              <span className={styles.fileHint}>
                  .doc ( .docx)        .docx 
                .pdf,      .
              </span>
            </label>
          ) : (
            <label className={styles.field}>
              <span className={styles.label}> </span>
              <textarea
                className={styles.textarea}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="    .       ."
                rows={8}
              />
            </label>
          )}

          {uploadError && <p className={styles.error}>{uploadError}</p>}

          <button type="submit" className={styles.submit} disabled={isUploading || !isReady}>
            {isUploading ? "..." : " "}
          </button>
        </form>
      </div>
    </div>
  );
}
