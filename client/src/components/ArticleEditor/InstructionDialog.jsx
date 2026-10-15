import { useEffect, useRef, useState } from 'react';

export default function InstructionDialog({ instruction, onCancel, onSave }) {
  const [title, setTitle] = useState(instruction?.title || '');
  const [text, setText] = useState(instruction?.text || '');
  const dialogRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    titleRef.current?.focus();

    return () => {
      dialog.close();
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="article-instruction-dialog"
      aria-labelledby="article-instruction-dialog-title"
      onCancel={event => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          if (title.trim() && text.trim()) onSave({ title: title.trim(), text: text.trim() });
        }}
      >
        <div className="article-instruction-dialog__head">
          <h2 id="article-instruction-dialog-title">
            {instruction ? 'Редактировать инструкцию' : 'Вставить инструкцию'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Закрыть окно инструкции">
            ×
          </button>
        </div>
        <p>Полный текст появится в выделенном блоке. Кнопка скачивания добавится автоматически.</p>
        <label>
          Название инструкции
          <input
            ref={titleRef}
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          Полный текст инструкции
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={16}
            maxLength={500000}
            required
          />
        </label>
        <small>
          Сохраняются абзацы и переносы строк. Текст статьи можно продолжить после блока.
        </small>
        <div className="article-instruction-dialog__footer">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" disabled={!title.trim() || !text.trim()}>
            {instruction ? 'Сохранить инструкцию' : 'Вставить в статью'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
