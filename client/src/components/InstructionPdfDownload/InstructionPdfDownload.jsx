import PdfRegistrationModal from '../PdfRegistrationModal/PdfRegistrationModal.jsx';
import { formatAvailableInstructions } from '../../lib/downloadQuota.js';
import useInstructionPdfDownload from './hooks/useInstructionPdfDownload.js';

import './InstructionPdfDownload.css';

export default function InstructionPdfDownload({
  instructionId,
  downloadUrl,
  id = 'boykov-instruction-pdf-download',
}) {
  const {
    user,
    isRestoring,
    isRegistrationOpen,
    setRegistrationOpen,
    isDownloading,
    message,
    isCatalogDownload,
    isLimitReached,
    remaining,
    quotaError,
    handleClick,
  } = useInstructionPdfDownload(instructionId, downloadUrl);

  if (!instructionId) return null;

  const buttonText = isDownloading
    ? 'Готовим PDF…'
    : isLimitReached
      ? 'Скачивания закончились'
      : 'Скачать PDF';

  let statusText = '';
  if (isCatalogDownload) {
    if (isRestoring) statusText = 'Проверяем доступные инструкции…';
    else if (!user) statusText = 'Войдите, чтобы увидеть доступные инструкции';
    else if (quotaError) statusText = 'Не удалось проверить остаток скачиваний';
    else if (remaining === null) statusText = 'Проверяем доступные инструкции…';
    else statusText = formatAvailableInstructions(remaining);
  }

  return (
    <>
      <div
        id={id}
        className={['boykovPdfDownload', isDownloading ? 'boykovPdfDownload--loading' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="boykovPdfDownload__button"
          disabled={isRestoring || isDownloading || isLimitReached}
          aria-busy={isDownloading}
          aria-describedby={statusText ? `${id}-status` : undefined}
          onClick={handleClick}
        >
          <span className="boykovPdfDownload__badge" aria-hidden="true" />
          <span className="boykovPdfDownload__text">{buttonText}</span>
        </button>

        {statusText && (
          <span
            id={`${id}-status`}
            className="boykovPdfDownload__status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusText}
          </span>
        )}
      </div>

      {isRegistrationOpen && <PdfRegistrationModal onClose={() => setRegistrationOpen(false)} />}

      {message && (
        <div className={`boykovPdfMessage boykovPdfMessage--${message.type}`} role="status">
          {message.text}
        </div>
      )}
    </>
  );
}
