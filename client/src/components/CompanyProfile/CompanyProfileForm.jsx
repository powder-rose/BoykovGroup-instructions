import { useEffect, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FORM_MODULE_URL = '/assets/company-profile-form.js?v=20261015-company-profile';

/** Uses the same form as the standalone personal account. */
export default function CompanyProfileForm({ token, onComplete, onController }) {
  const rootRef = useRef(null);
  const callbacksRef = useRef({ onComplete, onController });
  const [loadState, setLoadState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    callbacksRef.current = { onComplete, onController };
  }, [onComplete, onController]);

  useEffect(() => {
    let active = true;
    let settled = false;
    let controller;
    setLoadState('loading');
    const timeout = window.setTimeout(() => {
      settled = true;
      if (active) setLoadState('error');
    }, 15000);
    const moduleUrl = new URL(FORM_MODULE_URL, window.location.origin).href;
    import(/* @vite-ignore */ moduleUrl)
      .then(({ mountCompanyProfileForm }) => {
        if (!active || settled) return;
        settled = true;
        window.clearTimeout(timeout);
        controller = mountCompanyProfileForm(rootRef.current, {
          getToken: () => (active ? token : null),
          apiBaseUrl: API_BASE_URL,
          mode: 'onboarding',
          onComplete: (...args) => {
            if (active) callbacksRef.current.onComplete?.(...args);
          },
        });
        callbacksRef.current.onController?.(controller);
        setLoadState('ready');
      })
      .catch(() => {
        settled = true;
        window.clearTimeout(timeout);
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller?.destroy();
      callbacksRef.current.onController?.(null);
    };
  }, [token, attempt]);

  return (
    <>
      <div ref={rootRef} />
      {loadState === 'error' && (
        <section className="company-profile">
          <h2 className="company-profile__title">Данные компании</h2>
          <p role="alert" className="company-profile__description">
            Не удалось загрузить форму. Можно попробовать ещё раз или заполнить данные позже в
            личном кабинете.
          </p>
          <div className="company-profile__actions">
            <button
              type="button"
              className="company-profile__button"
              onClick={() => setAttempt(value => value + 1)}
            >
              Попробовать ещё раз
            </button>
            <button
              type="button"
              className="company-profile__button"
              onClick={() => onComplete?.(null, { action: 'deferred' })}
            >
              Продолжить без заполнения
            </button>
          </div>
        </section>
      )}
      {loadState === 'loading' && (
        <p className="company-profile-onboarding__loading" role="status">
          Загружаем форму компании…
        </p>
      )}
    </>
  );
}
