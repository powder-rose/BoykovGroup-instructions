import { useEffect, useRef } from 'react';
import ArticleContent from '../ArticleContent/ArticleContent.jsx';

export default function ArticlePreview({ article, onClose }) {
  const dialogRef = useRef(null);
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
      className="admin-article-preview"
      aria-labelledby="admin-article-preview-heading"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="admin-article-preview__bar">
        <span>Предпросмотр текущего содержимого</span>
        <button type="button" onClick={onClose}>
          Закрыть предпросмотр
        </button>
      </div>
      <article>
        <h1 id="admin-article-preview-heading">{article.title || 'Заголовок статьи'}</h1>
        {article.excerpt && <p className="admin-article-preview__excerpt">{article.excerpt}</p>}
        <ArticleContent content={article.content} slug={article.slug} preview />
      </article>
    </dialog>
  );
}
