export default function InstructionSeoStatus({ ready = false }) {
  return (
    <span className={`instruction-seo-status is-${ready ? 'ready' : 'needed'}`}>
      {ready && <span aria-hidden="true">✨ </span>}
      {ready ? 'SEO готово' : 'Нужно SEO'}
    </span>
  );
}

export function InstructionEditorialDate({ value, isNew = false }) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    return <span>{isNew ? 'Ещё не сохранено' : 'Дата не зафиксирована'}</span>;
  }
  return (
    <time dateTime={value}>
      {date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </time>
  );
}

export function InstructionEditorialMeta({
  metadata,
  label,
  isNew = false,
  explainDetection = false,
}) {
  return (
    <div className="instruction-editorial-meta">
      <div className="instruction-editorial-meta__status">
        {label && <span className="instruction-editorial-meta__label">{label}</span>}
        <InstructionSeoStatus ready={metadata?.seoReady === true} />
      </div>
      <dl className="instruction-editorial-meta__dates">
        <div>
          <dt>Текст инструкции</dt>
          <dd>
            <InstructionEditorialDate value={metadata?.contentUpdatedAt} isNew={isNew} />
          </dd>
          <dd className="instruction-editorial-meta__author">
            {metadata?.contentAuthor ? `Автор: ${metadata.contentAuthor}` : 'Автор не указан'}
          </dd>
        </div>
        <div>
          <dt>SEO-правки</dt>
          <dd>
            <InstructionEditorialDate value={metadata?.seoUpdatedAt} isNew={isNew} />
          </dd>
          <dd className="instruction-editorial-meta__author">
            {metadata?.seoAuthor ? `Автор: ${metadata.seoAuthor}` : 'Автор не указан'}
          </dd>
        </div>
      </dl>
      {explainDetection && metadata?.seoReadySource === 'detected' && (
        <p className="instruction-editorial-meta__note">
          Готовность определена по ранее заполненным полям. Это не оценка качества SEO.
        </p>
      )}
    </div>
  );
}
