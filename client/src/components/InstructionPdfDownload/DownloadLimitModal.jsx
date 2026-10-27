import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatRubles, walletPaymentUrl } from '../../../public/assets/wallet-client.js';
import './DownloadLimitModal.css';

export default function DownloadLimitModal({
  instructionId,
  format,
  wallet,
  busy,
  error,
  onConfirm,
  onClose,
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const word = format === 'docx';
  const label = word ? 'Word' : 'PDF';
  const funded = wallet.balanceMinor >= wallet.priceMinor;
  useEffect(() => {
    const dialog = dialogRef.current;
    const focus = document.activeElement;
    const overflow = document.documentElement.style.overflow;
    dialog.showModal();
    cancelRef.current.focus();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      if (focus?.isConnected) focus.focus();
    };
  }, []);
  return (
    <dialog
      className="download-limit"
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="download-limit__close"
        type="button"
        onClick={onClose}
        disabled={busy}
        aria-label="Закрыть"
      >
        ×
      </button>
      <p className="download-limit__eyebrow">
        [ {word ? 'WORD / РЕДАКТИРУЕМЫЙ ДОКУМЕНТ' : 'PDF / ГОТОВ К ПЕЧАТИ'} ]
      </p>
      <h2 id={titleId}>{funded ? `Купить ${label} за 50 ₽?` : 'Не хватает средств на балансе'}</h2>
      <p id={descriptionId} className="download-limit__description">
        {word
          ? 'Word доступен только платно. Бесплатный лимит действует для PDF. '
          : 'Бесплатные скачивания PDF закончились. '}
        {funded
          ? 'Спишем 50 ₽ с баланса только после вашего подтверждения.'
          : `Пополните баланс, чтобы купить ${label} за 50 ₽.`}
      </p>
      <div className="download-limit__price">
        <strong>50 ₽</strong>
        <span>
          за документ {label}
          <br />
          повторные скачивания бесплатно
        </span>
      </div>
      <div className="download-limit__balance">
        <span>На балансе</span>
        <strong>{formatRubles(wallet.balanceMinor)}</strong>
      </div>
      <div className="download-limit__balance">
        <span>{funded ? 'После покупки' : 'Не хватает'}</span>
        <strong>
          {formatRubles(
            funded
              ? wallet.balanceMinor - wallet.priceMinor
              : wallet.priceMinor - wallet.balanceMinor,
          )}
        </strong>
      </div>
      {error && (
        <p className="download-limit__error" role="alert">
          {error}
        </p>
      )}
      {funded ? (
        <button className="download-limit__buy" type="button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Готовим документ…' : 'Списать 50 ₽ и скачать'}
          <span aria-hidden="true">↓</span>
        </button>
      ) : (
        <Link
          className="download-limit__buy"
          to={walletPaymentUrl(instructionId, null, format)}
          onClick={onClose}
        >
          Пополнить баланс<span aria-hidden="true">→</span>
        </Link>
      )}
      <button
        className="download-limit__later"
        type="button"
        ref={cancelRef}
        disabled={busy}
        onClick={onClose}
      >
        {funded ? 'Отмена' : 'Вернуться к инструкции'}
      </button>
    </dialog>
  );
}
