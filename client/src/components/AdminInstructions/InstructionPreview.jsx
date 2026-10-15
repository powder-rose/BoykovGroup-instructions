import { useEffect, useRef } from 'react';
import { getInstructionOutline } from '../../../../server/src/shared/instructionDocument.js';
import InstructionTableOfContents from '../InstructionPage/InstructionTableOfContents.jsx';
import RichTextContent from '../RichTextContent/RichTextContent.jsx';

export default function InstructionPreview({ instruction, onClose }) {
  const dialogRef = useRef(null);
  const outline = getInstructionOutline(
    instruction.instructionContent,
    'instruction-preview-section',
  );
  useEffect(() => {
    const dialog = dialogRef.current;
    const focused = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      focused?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="admin-instruction-preview"
      aria-labelledby="admin-instruction-preview-heading"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="admin-instruction-preview__bar">
        <span>Предпросмотр инструкции</span>
        <button type="button" onClick={onClose}>
          Закрыть предпросмотр
        </button>
      </div>
      <article>
        <h1 id="admin-instruction-preview-heading">
          {instruction.title || 'Заголовок инструкции'}
        </h1>
        {instruction.webIntro && (
          <p className="admin-instruction-preview__excerpt">{instruction.webIntro}</p>
        )}
        <section
          className="instruction-editor-preview-document"
          aria-label="Полный текст инструкции"
        >
          <div className="instruction-editor-document-label">Инструкция</div>
          <div className="instruction-editor-download-preview">
            <button type="button" disabled>
              Скачать инструкцию в PDF
            </button>
            <p>Скачивание доступно зарегистрированным пользователям на опубликованной странице.</p>
          </div>
          <InstructionTableOfContents items={outline} />
          <RichTextContent
            content={instruction.instructionContent}
            headingIdPrefix="instruction-preview-section"
          />
        </section>
        <RichTextContent
          content={instruction.explanationContent}
          headingIdPrefix="instruction-preview-explanation"
        />
        <p className="instruction-editor-preview-related">
          Похожие инструкции появятся автоматически после публикации.
        </p>
      </article>
    </dialog>
  );
}
