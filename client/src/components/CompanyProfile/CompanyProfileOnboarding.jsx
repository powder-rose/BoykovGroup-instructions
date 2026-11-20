import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  completeCompanyProfileOnboarding,
  selectAuthToken,
  selectAuthUser,
  selectCompanyProfileOnboardingPending,
  selectCompanyRegistrationNotice,
} from '../../store/authSlice.js';
import CompanyProfileForm from './CompanyProfileForm.jsx';
import './CompanyProfileOnboarding.css';

function OnboardingDialog({ token, notice, onComplete }) {
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="company-profile-onboarding"
      aria-label="Инструкции с данными вашей компании"
      onCancel={event => {
        event.preventDefault();
        void controllerRef.current?.dismiss();
      }}
    >
      <p className="company-profile-onboarding__notice" role="status">
        {notice || 'Аккаунт готов. Настройте данные для ваших инструкций.'}
      </p>
      <CompanyProfileForm
        token={token}
        onComplete={onComplete}
        onController={controller => {
          controllerRef.current = controller;
        }}
      />
    </dialog>
  );
}

export default function CompanyProfileOnboarding() {
  const dispatch = useDispatch();
  const pending = useSelector(selectCompanyProfileOnboardingPending);
  const token = useSelector(selectAuthToken);
  const user = useSelector(selectAuthUser);
  const notice = useSelector(selectCompanyRegistrationNotice);

  if (!pending || !token) return null;

  return (
    <OnboardingDialog
      key={user.id}
      token={token}
      notice={notice}
      onComplete={() => dispatch(completeCompanyProfileOnboarding(user.id))}
    />
  );
}
