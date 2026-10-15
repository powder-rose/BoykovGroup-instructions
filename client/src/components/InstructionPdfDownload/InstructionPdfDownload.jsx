import PdfRegistrationModal from '../PdfRegistrationModal/PdfRegistrationModal.jsx';

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
    isLockedUser,
    handleClick,
  } = useInstructionPdfDownload(instructionId, downloadUrl);

  if (!instructionId) {
    return null;
  }

  const buttonText = isDownloading
    ? 'Формируем PDF...'
    : isLockedUser
      ? 'Подтвердите e-mail для PDF'
      : 'Скачать PDF';

  return (
    <>
      <div
        id={id}
        className={[
          'boykovPdfDownload',

          !user ? 'boykovPdfDownload--guest' : '',

          isLockedUser ? 'boykovPdfDownload--locked' : '',

          isDownloading ? 'boykovPdfDownload--loading' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="boykovPdfDownload__button"
          disabled={isRestoring || isDownloading || isLockedUser}
          onClick={handleClick}
        >
          <span className="boykovPdfDownload__badge">PDF</span>

          <span className="boykovPdfDownload__text">{buttonText}</span>
        </button>

        <span className="boykovPdfDownload__status" />
      </div>

      {isRegistrationOpen && <PdfRegistrationModal onClose={() => setRegistrationOpen(false)} />}

      {message && (
        <div
          className={[
            'boykovPdfMessage',

            message.type === 'success' ? 'boykovPdfMessage--success' : 'boykovPdfMessage--error',
          ]
            .filter(Boolean)
            .join(' ')}
          role="status"
        >
          {message.text}
        </div>
      )}
    </>
  );
}
