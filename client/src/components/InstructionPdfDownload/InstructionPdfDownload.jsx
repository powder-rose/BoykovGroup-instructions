import PdfRegistrationModal from '../PdfRegistrationModal/PdfRegistrationModal.jsx';
import { formatAvailableInstructions } from '../../lib/downloadQuota.js';
import useInstructionPdfDownload from './hooks/useInstructionPdfDownload.js';

import './InstructionPdfDownload.css';
import DownloadLimitModal from './DownloadLimitModal.jsx';

export default function InstructionPdfDownload({
  instructionId,
  downloadUrl,
  id = 'boykov-instruction-pdf-download',
}) {
  const {
    user,
    purchaseDialog,
    closePurchaseDialog,
    confirmPurchase,
    activeFormat,
    wordPurchaseId,
    handleWordClick,
    purchaseId,
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

  const buttonText =
    isDownloading && activeFormat === 'pdf'
      ? 'Обрабатываем запрос…'
      : isLimitReached
        ? 'Купить инструкцию'
        : 'Скачать PDF';

  let statusText = '';
  if (isCatalogDownload) {
    if (isRestoring) statusText = 'Проверяем доступные инструкции…';
    else if (!user) statusText = 'Войдите, чтобы увидеть доступные инструкции';
    else if (purchaseId) statusText = 'Инструкция куплена. Повторное скачивание бесплатно';
    else if (quotaError) statusText = 'Не удалось проверить остаток скачиваний';
    else if (remaining === null) statusText = 'Проверяем доступные инструкции…';
    else if (isLimitReached) statusText = 'PDF за 50 ₽ · покупка после подтверждения';
    else statusText = formatAvailableInstructions(remaining);
  }

  return (
    <>
      <div
        id={id}
        className={[
          'boykovPdfDownload',
          isDownloading && activeFormat === 'pdf' ? 'boykovPdfDownload--loading' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="boykovPdfDownload__formats">
          <div className="boykovPdfDownload__format">
            <button
              type="button"
              className="boykovPdfDownload__button"
              disabled={isRestoring || isDownloading}
              aria-busy={isDownloading && activeFormat === 'pdf'}
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
          {!downloadUrl && user?.role !== 'admin' && (
            <div className="boykovPdfDownload__format">
              <button
                type="button"
                className="boykovPdfDownload__word"
                disabled={isRestoring || isDownloading}
                aria-busy={isDownloading && activeFormat === 'docx'}
                aria-describedby={`${id}-word-status`}
                onClick={handleWordClick}
              >
                <span>
                  {isDownloading && activeFormat === 'docx' ? 'Готовим Word…' : 'Скачать Word'}
                </span>
                {!wordPurchaseId && <span className="boykovPdfDownload__price">50 ₽</span>}
              </button>
              <span id={`${id}-word-status`} className="boykovPdfDownload__status">
                {wordPurchaseId
                  ? 'Word куплен. Повторное скачивание бесплатно'
                  : 'Редактируемый DOCX · только платно'}
              </span>
            </div>
          )}
        </div>
      </div>

      {purchaseDialog && (
        <DownloadLimitModal
          instructionId={instructionId}
          format={purchaseDialog.format}
          wallet={purchaseDialog.wallet}
          busy={isDownloading}
          error={purchaseDialog.error}
          onConfirm={confirmPurchase}
          onClose={closePurchaseDialog}
        />
      )}

      {isRegistrationOpen && (
        <PdfRegistrationModal format={activeFormat} onClose={() => setRegistrationOpen(false)} />
      )}

      {message && (
        <div className={`boykovPdfMessage boykovPdfMessage--${message.type}`} role="status">
          {message.text}
        </div>
      )}
    </>
  );
}
