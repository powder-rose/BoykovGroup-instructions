import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import {
  selectAuthToken,
  selectAuthUser,
  selectIsRestoringSession,
} from '../../store/authSlice.js';
import Header from '../../components/Header/Header.jsx';
import Navigation from '../../components/Navigation/Navigation.jsx';
import SEO from '../../components/SEO/SEO.jsx';
import PdfRegistrationModal from '../../components/PdfRegistrationModal/PdfRegistrationModal.jsx';
import { formatRubles } from '../../../public/assets/wallet-client.js';
import useWalletCheckout from './useWalletCheckout.js';
import '../../../public/assets/wallet.css';
import './WalletPaymentPage.css';

function TopupForm({ busy, topup, balanceMinor, priceMinor }) {
  const [amount, setAmount] = useState('50');
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [personalDataConsentAccepted, setPersonalDataConsentAccepted] = useState(false);
  const amountMinor = Number(amount) * 100;
  const validAmount =
    /^\d+$/u.test(amount) &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor >= 5000 &&
    amountMinor <= 1_000_000 &&
    amountMinor % 5000 === 0;
  return (
    <form
      className="wallet-topup"
      onSubmit={event => {
        event.preventDefault();
        if (validAmount && offerAccepted && personalDataConsentAccepted)
          void topup(amountMinor, { offerAccepted, personalDataConsentAccepted });
      }}
    >
      <h3>Пополнить баланс</h3>
      <p>
        {balanceMinor < priceMinor
          ? `Для покупки не хватает ${formatRubles(priceMinor - balanceMinor)}. `
          : ''}
        Выберите сумму. Остаток можно использовать для следующих инструкций.
      </p>
      <div className="wallet-topup__presets" aria-label="Сумма пополнения">
        {[50, 150, 300].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={amount === String(value)}
            disabled={Boolean(busy)}
            onClick={() => setAmount(String(value))}
          >
            {value} ₽
          </button>
        ))}
      </div>
      <label className="wallet-topup__amount">
        Другая сумма, ₽
        <input
          type="number"
          inputMode="numeric"
          min="50"
          max="10000"
          step="50"
          value={amount}
          disabled={Boolean(busy)}
          onChange={event => setAmount(event.target.value)}
          aria-describedby="wallet-amount-hint"
        />
      </label>
      <span id="wallet-amount-hint" className="wallet-muted">
        От 50 до 10 000 ₽, с шагом 50 ₽
      </span>
      <label className="wallet-consent">
        <input
          type="checkbox"
          checked={offerAccepted}
          onChange={event => setOfferAccepted(event.target.checked)}
          disabled={Boolean(busy)}
          required
        />
        <span>
          Принимаю{' '}
          <a href="/offer/" target="_blank" rel="noreferrer">
            условия оферты
          </a>
        </span>
      </label>
      <label className="wallet-consent">
        <input
          type="checkbox"
          checked={personalDataConsentAccepted}
          onChange={event => setPersonalDataConsentAccepted(event.target.checked)}
          disabled={Boolean(busy)}
          required
        />
        <span>
          Даю{' '}
          <a href="/personal-data-consent/" target="_blank" rel="noreferrer">
            согласие на обработку персональных данных
          </a>
        </span>
      </label>
      <button
        className="wallet-button wallet-button--wide"
        type="submit"
        disabled={Boolean(busy) || !validAmount || !offerAccepted || !personalDataConsentAccepted}
      >
        {busy === 'topup'
          ? 'Открываем оплату…'
          : `Пополнить на ${validAmount ? formatRubles(amountMinor) : '…'}`}
      </button>
      <p className="wallet-topup__provider">
        Защищённая оплата через CloudPayments.
        <br />
        Без подписки и автоматических списаний.
      </p>
    </form>
  );
}

function Checkout({ token, instructionId, topupId }) {
  const { data, busy, notice, pendingId, refresh, topup, checkPayment, buy } = useWalletCheckout(
    token,
    instructionId,
    topupId,
  );
  if (!data)
    return (
      <div className="wallet-panel">
        <p role="status">{notice?.text || 'Загружаем баланс…'}</p>
        {notice && (
          <button className="wallet-button" type="button" onClick={() => void refresh()}>
            Повторить
          </button>
        )}
      </div>
    );
  const { wallet, instruction, quota } = data;
  const owned = Boolean(instruction?.purchaseId);
  const free = !owned && quota.remaining > 0;
  const canBuy = instruction && !owned && !free && wallet.balanceMinor >= wallet.priceMinor;
  return (
    <>
      {notice && (
        <p
          className={`wallet-notice wallet-notice--${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}
      <div className="wallet-checkout__grid">
        <section className="wallet-checkout__document">
          <div className="wallet-eyebrow">
            [ {instruction ? 'ВАША ИНСТРУКЦИЯ' : 'КАК ЭТО РАБОТАЕТ'} ]
          </div>
          {instruction ? (
            <>
              <span className="wallet-document-icon" aria-hidden="true">
                PDF
              </span>
              <h2>{instruction.title}</h2>
              <p className="wallet-muted">
                Полный документ с данными вашей компании — готовый к сохранению и печати.
              </p>
              <div className="wallet-checkout__price">
                <span>
                  {owned ? 'Уже куплена' : free ? 'Доступно бесплатно' : 'Стоимость инструкции'}
                </span>
                <strong>{owned || free ? '0 ₽' : formatRubles(wallet.priceMinor)}</strong>
              </div>
            </>
          ) : (
            <h2>Больше нужных документов — без ожидания</h2>
          )}
        </section>
        <aside className="wallet-panel wallet-checkout__payment" aria-label="Баланс и оплата">
          <div className="wallet-eyebrow">[ ВАШ БАЛАНС ]</div>
          <div className="wallet-balance" aria-live="polite">
            {formatRubles(wallet.balanceMinor)}
          </div>
          {wallet.balanceMinor < 0 && (
            <p className="wallet-notice wallet-notice--error">
              После возврата платежа возникла задолженность. Для покупки сначала пополните баланс.
            </p>
          )}
          {owned && (
            <>
              <p className="wallet-muted">Эта инструкция уже ваша. Повторного списания не будет.</p>
              <button
                className="wallet-button wallet-button--wide"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void buy()}
              >
                {busy ? 'Готовим PDF…' : 'Скачать купленный PDF'}
              </button>
            </>
          )}
          {instruction && free && (
            <>
              <p className="wallet-muted">
                У вас ещё есть бесплатные скачивания. Эту инструкцию можно скачать без оплаты.
              </p>
              <Link
                className="wallet-button wallet-button--wide"
                to={`/instrukciya-po-ohrane-truda/${encodeURIComponent(instruction.id)}`}
              >
                Открыть инструкцию
              </Link>
            </>
          )}
          {canBuy && (
            <div className="wallet-checkout__purchase">
              <p>
                С баланса будет списано <strong>{formatRubles(wallet.priceMinor)}</strong>. После
                покупки останется {formatRubles(wallet.balanceMinor - wallet.priceMinor)}.
              </p>
              <button
                className="wallet-button wallet-button--wide"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void buy()}
              >
                {busy === 'purchase' ? 'Готовим инструкцию…' : 'Купить за 50 ₽ и скачать'}
              </button>
            </div>
          )}
          {pendingId && (
            <div className="wallet-pending">
              <strong>Есть незавершённая оплата</strong>
              <p>Если вы уже оплатили, проверьте поступление денег.</p>
              <button
                className="wallet-button wallet-button--secondary wallet-button--wide"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void checkPayment()}
              >
                {busy === 'confirm' ? 'Проверяем…' : 'Проверить оплату'}
              </button>
            </div>
          )}
          {(!instruction || (!owned && !free)) && (
            <TopupForm
              busy={busy}
              topup={topup}
              balanceMinor={wallet.balanceMinor}
              priceMinor={instruction ? wallet.priceMinor : 0}
            />
          )}
        </aside>
        <section className="wallet-checkout__steps" aria-label="Как оплатить инструкцию">
          <ol className="wallet-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Пополните баланс</strong>
                <p>
                  Выберите сумму и оплатите её через CloudPayments. Деньги появятся в личном
                  кабинете после подтверждения оплаты.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Выберите инструкцию</strong>
                <p>
                  Когда бесплатные скачивания закончатся, купите нужную инструкцию за 50 ₽ с
                  баланса.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Скачивайте, когда удобно</strong>
                <p>Купленный документ сохранится в кабинете. Повторные скачивания бесплатны.</p>
              </div>
            </li>
          </ol>
          <a className="wallet-text-link" href="/account/">
            Перейти в личный кабинет →
          </a>
        </section>
      </div>
    </>
  );
}

export default function WalletPaymentPage() {
  const token = useSelector(selectAuthToken);
  const user = useSelector(selectAuthUser);
  const restoring = useSelector(selectIsRestoringSession);
  const [params] = useSearchParams();
  const instructionId = params.get('instruction') || '';
  const topupId = params.get('topup') || '';
  const [query, setQuery] = useState('');
  const [login, setLogin] = useState(false);
  return (
    <div className="wallet-page">
      <SEO
        title="Оплата инструкции | БОЙКОВГРУПП"
        description="Пополнение баланса и покупка инструкции."
        noindex
      />
      <div className="wallet-page__header">
        <Header query={query} onQueryChange={setQuery} />
        <Navigation />
      </div>
      <main className="wallet-page__main">
        <Link
          className="wallet-text-link"
          to={
            instructionId
              ? `/instrukciya-po-ohrane-truda/${encodeURIComponent(instructionId)}`
              : '/instrukcii-po-ohrane-truda'
          }
        >
          ← {instructionId ? 'К инструкции' : 'В каталог'}
        </Link>
        <div className="wallet-page__hero">
          <p className="wallet-eyebrow">[ БОЙКОВГРУПП / ДОКУМЕНТЫ ]</p>
          <h1>
            {instructionId ? 'Нужная инструкция.\nВсего за 50 ₽.' : 'Баланс для ваших\nинструкций.'}
          </h1>
          <p>Одна покупка — доступ к документу в любое время.</p>
        </div>
        {restoring ? (
          <p role="status">Проверяем вход…</p>
        ) : user?.role === 'user' && token ? (
          <Checkout
            key={`${token}:${instructionId}`}
            token={token}
            instructionId={instructionId}
            topupId={topupId}
          />
        ) : (
          <section className="wallet-panel">
            <h2>Войдите в личный кабинет</h2>
            <p>Баланс и купленные инструкции привязаны к вашему аккаунту.</p>
            <button className="wallet-button" type="button" onClick={() => setLogin(true)}>
              Войти или зарегистрироваться
            </button>
          </section>
        )}
        {login && <PdfRegistrationModal onClose={() => setLogin(false)} />}
      </main>
    </div>
  );
}
