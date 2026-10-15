import { useRef, useState } from 'react';
import ArticleEditor from '../ArticleEditor/ArticleEditor.jsx';
import ArticlePreview from './ArticlePreview.jsx';
import {
  articleToForm,
  getDraftKey,
  removeArticleDraft,
  validateArticleForm,
} from './articleForm.js';
import useArticleDraft from './useArticleDraft.js';

export default function ArticleForm({ record, identity, saving, onSave, onClose }) {
  const savingRef = useRef(false);
  const [form, setForm] = useState(() => articleToForm(record));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const initial = articleToForm(record);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const draftKey = getDraftKey(identity, record?.id);
  const { savedDraft, storageError, restoreDraft, discardDraft, persistDraft } = useArticleDraft({
    draftKey,
    form,
    revision: record?.revision ?? null,
    dirty,
    onRestore: setForm,
  });

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function close() {
    if (saving) return;
    if (
      dirty &&
      !window.confirm('Закрыть редактор? Несохранённые изменения останутся в локальном черновике.')
    )
      return;
    persistDraft();
    onClose();
  }

  async function save(status) {
    if (savingRef.current) return;
    const validation = validateArticleForm(form, status);
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    savingRef.current = true;
    try {
      await onSave({ ...form, status });
      removeArticleDraft(draftKey);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      savingRef.current = false;
    }
  }

  const fields = [
    { name: 'title', label: 'Заголовок статьи', maxLength: 200, required: true },
    {
      name: 'slug',
      label: 'URL статьи',
      maxLength: 160,
      placeholder: 'Создастся из заголовка, если оставить пустым',
    },
    { name: 'excerpt', label: 'Краткое описание', maxLength: 600, multiline: true },
  ];

  return (
    <div className="admin-article-form">
      <div className="admin-article-form__head">
        <button type="button" onClick={close} disabled={saving}>
          ← К списку статей
        </button>
        <span role="status">
          {dirty
            ? 'Есть несохранённые изменения'
            : record?.id
              ? 'Все изменения сохранены'
              : 'Новая статья'}
        </span>
      </div>
      <h3>{record?.id ? 'Редактирование статьи' : 'Новая статья'}</h3>
      {savedDraft && (
        <div className="admin-articles__notice">
          <p>
            {savedDraft.revision !== (record?.revision ?? null)
              ? 'Найден локальный черновик другой версии. Восстановление заменит содержимое формы; опубликованная статья изменится только после сохранения.'
              : 'Найден несохранённый локальный черновик этой статьи.'}
          </p>
          <button type="button" onClick={restoreDraft}>
            Восстановить черновик
          </button>
          <button type="button" onClick={discardDraft}>
            Удалить локальный черновик
          </button>
        </div>
      )}
      {storageError && (
        <p className="admin-articles__error" role="alert">
          {storageError}
        </p>
      )}
      <fieldset disabled={saving || Boolean(savedDraft)}>
        <div className="admin-article-form__metadata">
          {fields.map(field => (
            <label key={field.name}>
              {field.label}
              {field.required ? ' *' : ''}
              {field.multiline ? (
                <textarea
                  rows={3}
                  value={form[field.name]}
                  maxLength={field.maxLength}
                  onChange={event => change(field.name, event.target.value)}
                />
              ) : (
                <input
                  value={form[field.name]}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={event => change(field.name, event.target.value)}
                />
              )}
              {field.name === 'slug' && <small>/stati/{form.slug || 'adres-stati'}</small>}
            </label>
          ))}
        </div>
        <div className="admin-article-form__body">
          <h4>Текст статьи</h4>
          <ArticleEditor
            value={form.content}
            onChange={content => change('content', content)}
            disabled={saving || Boolean(savedDraft)}
          />
        </div>
        <div className="admin-article-form__seo">
          <h4>SEO</h4>
          <p>Для публикации заполните оба SEO-поля.</p>
          <label>
            SEO Title
            <input
              value={form.seoTitle}
              maxLength={200}
              onChange={event => change('seoTitle', event.target.value)}
            />
          </label>
          <label>
            SEO Description
            <textarea
              rows={3}
              value={form.seoDescription}
              maxLength={400}
              onChange={event => change('seoDescription', event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      {error && (
        <p className="admin-articles__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-article-form__actions">
        <button type="button" disabled={saving} onClick={() => setPreview(true)}>
          Предпросмотр
        </button>
        {record?.status === 'published' ? (
          <>
            <button
              type="button"
              disabled={saving || Boolean(savedDraft)}
              onClick={() => save('draft')}
            >
              Снять с публикации
            </button>
            <button
              type="button"
              className="admin-articles__primary"
              disabled={saving || Boolean(savedDraft)}
              onClick={() => save('published')}
            >
              {saving ? 'Сохранение…' : 'Сохранить изменения'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={saving || Boolean(savedDraft)}
              onClick={() => save('draft')}
            >
              {saving ? 'Сохранение…' : 'Сохранить черновик'}
            </button>
            <button
              type="button"
              className="admin-articles__primary"
              disabled={saving || Boolean(savedDraft)}
              onClick={() => save('published')}
            >
              Опубликовать
            </button>
          </>
        )}
      </div>
      {preview && <ArticlePreview article={form} onClose={() => setPreview(false)} />}
    </div>
  );
}
