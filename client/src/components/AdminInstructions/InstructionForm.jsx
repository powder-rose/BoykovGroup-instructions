import { useRef, useState } from 'react';
import RichTextEditor from '../RichTextEditor/RichTextEditor.jsx';
import InstructionPreview from './InstructionPreview.jsx';
import {
  instructionToForm,
  getDraftKey,
  removeInstructionDraft,
  validateInstructionForm,
} from './instructionForm.js';
import useInstructionDraft from './useInstructionDraft.js';

export default function InstructionForm({
  envelope,
  identity,
  saving,
  history,
  onSave,
  onClose,
  onDiscard,
  onRollback,
  onUnpublish,
}) {
  const record = envelope.instruction;
  const savingRef = useRef(false);
  const [form, setForm] = useState(() => instructionToForm(record || undefined));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(instructionToForm(record || undefined));
  const draftKey = getDraftKey(identity, record?.id);
  const { savedDraft, storageError, restoreDraft, discardDraft, persistDraft } =
    useInstructionDraft({
      draftKey,
      form,
      revision: record?.revision ?? null,
      dirty,
      onRestore: setForm,
    });
  const blocked = saving || Boolean(savedDraft);

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
    const validation = validateInstructionForm(form, status, record?.slug || record?.id || '');
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    savingRef.current = true;
    try {
      await onSave({ ...form, status });
      removeInstructionDraft(draftKey);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      savingRef.current = false;
    }
  }
  async function act(action) {
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <div className="admin-instruction-form">
      <div className="admin-instruction-form__head">
        <button type="button" data-close-instruction-editor onClick={close} disabled={saving}>
          ← Закрыть редактор
        </button>
        <span role="status">
          {dirty
            ? 'Есть несохранённые изменения'
            : record?.id
              ? 'Все изменения сохранены'
              : 'Новая инструкция'}
        </span>
      </div>
      <h2>{record?.id ? 'Редактирование инструкции' : 'Создать инструкцию'}</h2>
      {envelope.hasPublishedVersion && envelope.hasDraft && (
        <p className="admin-instructions__notice">
          На сайте доступна опубликованная версия. Сейчас вы редактируете её черновик.
        </p>
      )}
      {savedDraft && (
        <div className="admin-instructions__notice">
          <p>
            {savedDraft.revision !== (record?.revision ?? null)
              ? 'Найден локальный черновик другой версии. Восстановление заменит форму; опубликованная инструкция останется прежней до публикации.'
              : 'Найден несохранённый локальный черновик этой инструкции.'}
          </p>
          <button type="button" onClick={restoreDraft}>
            Восстановить локальный черновик
          </button>
          <button type="button" onClick={discardDraft}>
            Удалить локальный черновик
          </button>
        </div>
      )}
      {storageError && (
        <p className="admin-instructions__error" role="alert">
          {storageError}
        </p>
      )}
      <fieldset disabled={blocked}>
        <div className="admin-instruction-form__metadata">
          <label>
            Заголовок страницы (H1) *
            <input
              value={form.title}
              maxLength={200}
              onChange={event => change('title', event.target.value)}
            />
          </label>
          <label>
            URL инструкции
            <input
              value={form.slug}
              maxLength={160}
              placeholder="Создастся из заголовка, если оставить пустым"
              onChange={event => change('slug', event.target.value)}
            />
            <small>/instrukciya-po-ohrane-truda/{form.slug || 'adres-instrukcii'}</small>
          </label>
          <label>
            Короткое вступление на странице
            <textarea
              rows={3}
              value={form.webIntro}
              maxLength={2000}
              onChange={event => change('webIntro', event.target.value)}
            />
            <small>Появится перед инструкцией на сайте.</small>
          </label>
        </div>
        <section
          className="admin-instruction-form__body"
          aria-labelledby="instruction-main-editor-heading"
        >
          <h3 id="instruction-main-editor-heading">Основная инструкция</h3>
          <p className="instruction-editor-description">
            Полный текст инструкции. Заголовки H2/H3 автоматически попадут в содержание. Кнопка
            скачивания будет показана под этим блоком.
          </p>
          <RichTextEditor
            value={form.instructionContent}
            onChange={value => change('instructionContent', value)}
            disabled={blocked}
            label="Основная инструкция"
          />
        </section>
        <section
          className="admin-instruction-form__body"
          aria-labelledby="instruction-explanation-editor-heading"
        >
          <h3 id="instruction-explanation-editor-heading">Разъяснения после инструкции</h3>
          <p className="instruction-editor-description">
            Дополнительный текст для страницы сайта. Поле можно оставить пустым.
          </p>
          <RichTextEditor
            value={form.explanationContent}
            onChange={value => change('explanationContent', value)}
            disabled={blocked}
            label="Разъяснения после инструкции"
          />
        </section>
        <section className="admin-instruction-form__seo">
          <h3>SEO</h3>
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
        </section>
      </fieldset>
      {error && (
        <p className="admin-instructions__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-instruction-form__actions">
        <button type="button" disabled={saving} onClick={() => setPreview(true)}>
          Предпросмотр
        </button>
        <button type="button" disabled={blocked} onClick={() => save('draft')}>
          {saving ? 'Сохранение…' : 'Сохранить черновик'}
        </button>
        <button
          type="button"
          className="admin-instructions__primary"
          disabled={blocked}
          onClick={() => save('published')}
        >
          {envelope.hasPublishedVersion ? 'Опубликовать изменения' : 'Опубликовать'}
        </button>
      </div>
      {record?.id && (
        <div className="instruction-editor-secondary-actions">
          {envelope.hasDraft && (
            <button type="button" disabled={blocked || dirty} onClick={() => act(onDiscard)}>
              Удалить серверный черновик
            </button>
          )}
          {envelope.hasPublishedVersion && (
            <button type="button" disabled={blocked || dirty} onClick={() => act(onUnpublish)}>
              Снять с публикации
            </button>
          )}
          {envelope.hasPublishedVersion && (
            <button
              type="button"
              disabled={blocked || dirty || envelope.hasDraft || !history?.available}
              onClick={() => act(onRollback)}
            >
              {history?.available
                ? `Откатить последнее сохранение${history.count > 1 ? ` · ${history.count} версий` : ''}`
                : 'Нет предыдущей версии'}
            </button>
          )}
          {envelope.hasDraft && envelope.hasPublishedVersion && (
            <small>Для отката опубликованной версии сначала удалите серверный черновик.</small>
          )}
        </div>
      )}
      {preview && <InstructionPreview instruction={form} onClose={() => setPreview(false)} />}
    </div>
  );
}
