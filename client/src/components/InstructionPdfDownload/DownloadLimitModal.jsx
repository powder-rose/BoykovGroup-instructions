import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { walletPaymentUrl } from '../../../public/assets/wallet-client.js';
import './DownloadLimitModal.css';

export default function DownloadLimitModal({ instructionId, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const focus = document.activeElement;
    const overflow = document.documentElement.style.overflow;
    dialog.showModal();
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
      aria-labelledby="download-limit-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="download-limit__close"
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
      >
        ×
      </button>
      <p className="download-limit__eyebrow">[ ЕЩЁ ОДНА ИНСТРУКЦИЯ ]</p>
      <h2 id="download-limit-title">Не хватает средств на балансе</h2>
      <p className="download-limit__description">
        Пополните баланс, затем вернитесь к инструкции и нажмите «Купить инструкцию». Повторное
        скачивание будет бесплатным.
      </p>
      <div className="download-limit__price">
        <strong>50 ₽</strong>
        <span>
          за одну инструкцию
          <br />
          повторные скачивания бесплатно
        </span>
      </div>
      <Link className="download-limit__buy" to={walletPaymentUrl(instructionId)} onClick={onClose}>
        Пополнить баланс <span aria-hidden="true">→</span>
      </Link>
      <button className="download-limit__later" type="button" onClick={onClose}>
        Вернуться к инструкции
      </button>
    </dialog>
  );
}
