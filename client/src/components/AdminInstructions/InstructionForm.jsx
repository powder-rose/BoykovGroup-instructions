import { useRef, useState } from 'react';
import RichTextEditor from '../RichTextEditor/RichTextEditor.jsx';
import InstructionPreview from './InstructionPreview.jsx';
import InstructionTaxonomyEditor from './InstructionTaxonomyEditor.jsx';
import InstructionSeoStatus, { InstructionEditorialMeta } from './InstructionSeoStatus.jsx';
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
  token,
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
  const [assignmentTaxonomy, setAssignmentTaxonomy] = useState(null);
  const [taxonomyConflict, setTaxonomyConflict] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(instructionToForm(record || undefined));
  const draftKey = getDraftKey(identity, record?.id);
  const { savedDraft, storageError, restoreDraft, discardDraft, persistDraft } =
    useInstructionDraft({
      draftKey,
      form,
      revision: record?.revision ?? null,
      dirty,
      onRestore: localForm => {
        const currentForm = instructionToForm(record || undefined);
        setForm({
          ...currentForm,
          ...localForm,
          seoReady:
            typeof localForm.seoReady === 'boolean' ? localForm.seoReady : currentForm.seoReady,
          seoAuthor:
            typeof localForm.seoAuthor === 'string' ? localForm.seoAuthor : currentForm.seoAuthor,
          contentAuthor:
            typeof localForm.contentAuthor === 'string'
              ? localForm.contentAuthor
              : currentForm.contentAuthor,
          taxonomyPatch:
            localForm.taxonomyPatch &&
            typeof localForm.taxonomyPatch === 'object' &&
            !Array.isArray(localForm.taxonomyPatch)
              ? localForm.taxonomyPatch
              : {},
        });
      },
    });
  const blocked = saving || Boolean(savedDraft);

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }
  function changeCategory(id, registryRevision) {
    setForm(current => ({
      ...current,
      primaryCategoryId: id,
      taxonomyPatch: {
        ...current.taxonomyPatch,
        category: { mode: 'manual', id },
        ...(!record?.id && !current.taxonomyPatch.tags
          ? { tags: { mode: 'manual', ids: [...current.tagIds] } }
          : {}),
        registryRevision: current.taxonomyPatch.registryRevision ?? registryRevision,
      },
    }));
  }
  function changeTags(ids, registryRevision) {
    setForm(current => ({
      ...current,
      tagIds: ids,
      taxonomyPatch: {
        ...current.taxonomyPatch,
        tags: { mode: 'manual', ids },
        registryRevision: current.taxonomyPatch.registryRevision ?? registryRevision,
      },
    }));
  }
  function confirmTaxonomyRevision(registryRevision) {
    setForm(current => ({
      ...current,
      taxonomyPatch: { ...current.taxonomyPatch, registryRevision },
    }));
    setTaxonomyConflict(false);
    setError('');
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
    const validation = validateInstructionForm(form, status, record?.slug || record?.id || '', {
      requireSection: !record?.id,
      taxonomy: assignmentTaxonomy,
    });
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
      setTaxonomyConflict(saveError.code === 'TAXONOMY_REVISION_CONFLICT');
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
      <div className="instruction-editorial-versions admin-instruction-form__editorial">
        <InstructionEditorialMeta
          metadata={record?.editorialMeta}
          label={
            record?.id ? (envelope.hasDraft ? 'В черновике:' : 'На сайте:') : 'Новая инструкция:'
          }
          isNew={!record?.id}
          explainDetection
        />
        {envelope.hasDraft && envelope.hasPublishedVersion && (
          <InstructionEditorialMeta
            metadata={envelope.publishedEditorialMeta}
            label="На сайте:"
            explainDetection
          />
        )}
      </div>
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
        <InstructionTaxonomyEditor
          token={token}
          record={record}
          form={form}
          onCategory={changeCategory}
          onTags={changeTags}
          onDictionary={setAssignmentTaxonomy}
          onConfirmRevision={confirmTaxonomyRevision}
          revisionConflict={taxonomyConflict}
        />
        <section
          className="admin-instruction-form__body"
          aria-labelledby="instruction-main-editor-heading"
        >
          <h3 id="instruction-main-editor-heading">Основная инструкция</h3>
          <p className="instruction-editor-description">
            Полный текст инструкции. Заголовки H2/H3 автоматически попадут в содержание. Кнопка
            скачивания будет показана перед содержанием и текстом инструкции.
          </p>
          <label className="admin-instruction-form__author">
            Автор текста инструкции
            <input
              value={form.contentAuthor}
              maxLength={120}
              onChange={event => change('contentAuthor', event.target.value)}
            />
            <small>Имя или название редакции. Видно только администраторам.</small>
          </label>
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
          <div className="admin-instruction-form__seo-control">
            <label className="admin-instruction-form__seo-ready">
              <input
                type="checkbox"
                checked={form.seoReady === true}
                onChange={event => change('seoReady', event.target.checked)}
              />
              SEO готово
            </label>
            <InstructionSeoStatus ready={form.seoReady === true} />
            <small>
              Отметьте, когда завершите SEO-работу. Статус сохранится вместе с черновиком или
              публикацией; даты обновятся после сохранения соответствующих изменений.
            </small>
          </div>
          <label>
            Автор SEO-подготовки
            <input
              value={form.seoAuthor}
              maxLength={120}
              onChange={event => change('seoAuthor', event.target.value)}
            />
            <small>Подпись автора не меняет дату SEO-правок.</small>
          </label>
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
