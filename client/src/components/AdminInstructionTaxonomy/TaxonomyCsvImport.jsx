import { useState } from 'react';
import TaxonomyCsvImportReport from './TaxonomyCsvImportReport.jsx';
import { MAX_TAXONOMY_CSV_BYTES } from './taxonomyImportReport.js';
import base from './AdminInstructionTaxonomy.module.css';
import styles from './TaxonomyBulkWorkspace.module.css';

export default function TaxonomyCsvImport({
  hidden,
  dictionary,
  dictionaryLoading,
  busy,
  blocked,
  result,
  onPrepare,
  onInvalidate,
}) {
  const [file, setFile] = useState(null);
  const [tagMode, setTagMode] = useState('add');
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [fileError, setFileError] = useState('');

  function chooseFile(event) {
    const next = event.target.files?.[0] || null;
    onInvalidate();
    setScopeConfirmed(false);
    setReplaceConfirmed(false);
    setFileError('');
    if (next && (!next.size || next.size > MAX_TAXONOMY_CSV_BYTES)) {
      setFile(null);
      setFileError('Выберите непустой CSV-файл размером не больше 4 МиБ.');
      return;
    }
    setFile(next);
  }

  function submit(event) {
    event.preventDefault();
    if (
      busy ||
      blocked ||
      !file ||
      !dictionary ||
      dictionaryLoading ||
      !scopeConfirmed ||
      (tagMode === 'replace' && !replaceConfirmed)
    )
      return;
    onPrepare({ file, tagMode, scopeConfirmed, replaceConfirmed });
  }

  return (
    <section hidden={hidden} aria-labelledby="taxonomy-csv-heading">
      <h3 id="taxonomy-csv-heading">Импорт распределения из CSV</h3>
      <p className={base.muted}>
        Загружайте CSV в UTF-8 с BOM и разделителем «;», с 11 колонками исходного реестра.
        Сопоставление выполняется по URL существующей опубликованной инструкции. document_id —
        порядковый номер строки, он не используется как ID инструкции. Сначала проверьте импорт в
        тестовой среде.
      </p>
      <form className={styles.action} onSubmit={submit}>
        <div className={styles.actionFields}>
          <label className={base.label}>
            CSV-файл (до 4 МиБ)
            <input
              className={base.input}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={chooseFile}
            />
          </label>
          <label className={base.label}>
            Режим тегов
            <select
              className={base.input}
              value={tagMode}
              disabled={busy}
              onChange={event => {
                setTagMode(event.target.value);
                setScopeConfirmed(false);
                setReplaceConfirmed(false);
                onInvalidate();
              }}
            >
              <option value="add">Добавление — сохранить существующие теги</option>
              <option value="replace">Полная замена тегов</option>
            </select>
          </label>
        </div>
        {file && (
          <p className={base.muted}>
            {file.name} · {file.size.toLocaleString('ru-RU')} байт
          </p>
        )}
        {fileError && (
          <p className={base.error} role="alert">
            {fileError}
          </p>
        )}
        <p>
          Основной раздел берётся из CSV в обоих режимах, каталог определяется по разделу. При
          добавлении пустое поле тегов сохраняет текущие теги. При полной замене оно очищает их
          список. Текст, названия, SEO, URL, файлы и даты сохраняются.
        </p>
        {tagMode === 'replace' && (
          <label className={base.check}>
            <input
              type="checkbox"
              checked={replaceConfirmed}
              disabled={busy || !file}
              onChange={event => {
                setReplaceConfirmed(event.target.checked);
                onInvalidate();
              }}
            />
            Отдельно подтверждаю полную замену существующих тегов значениями CSV, включая снятие
            прежних тегов и очистку списка при пустом tags_ids.
          </label>
        )}
        <label className={base.check}>
          <input
            type="checkbox"
            checked={scopeConfirmed}
            disabled={busy || !file}
            onChange={event => {
              setScopeConfirmed(event.target.checked);
              onInvalidate();
            }}
          />
          Подтверждаю обработку опубликованной версии и каждого сохранённого черновика найденной
          инструкции, включая старые черновики. Черновики не будут опубликованы.
        </label>
        <button
          className={`${base.button} ${base.primary}`}
          type="submit"
          disabled={
            busy ||
            blocked ||
            !file ||
            !dictionary ||
            dictionaryLoading ||
            !scopeConfirmed ||
            (tagMode === 'replace' && !replaceConfirmed)
          }
        >
          {busy ? 'Подождите…' : 'Проверить CSV и подготовить предпросмотр'}
        </button>
      </form>
      {result?.importReport && (
        <TaxonomyCsvImportReport
          key={`${result.importReport.file.sha256}/${result.previewId || 'report'}/${result.registryRevision}`}
          report={result.importReport}
          dictionary={dictionary}
          busy={busy}
        />
      )}
    </section>
  );
}
