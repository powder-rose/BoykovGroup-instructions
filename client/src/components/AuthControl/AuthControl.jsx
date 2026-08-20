import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import LoginModal from "../LoginModal/LoginModal.jsx";
import { logout, selectAuthUser, selectIsAdmin, selectIsRestoringSession } from "../../store/authSlice.js";
import styles from "./AuthControl.module.css";

/** Кнопка «войти» / бейдж админа с выходом. Не путать с SiteLinkButton — это отдельный, служебный элемент. */
export default function AuthControl() {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const user = useSelector(selectAuthUser);
  const isRestoring = useSelector(selectIsRestoringSession);
  const [isModalOpen, setModalOpen] = useState(false);

  if (isRestoring) {
    return null;
  }

  if (isAdmin) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.badge}>[ админ: {user.login} ]</span>
        <button type="button" className={styles.logoutBtn} onClick={() => dispatch(logout())}>
          выйти
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" className={styles.loginBtn} onClick={() => setModalOpen(true)}>
        войти
      </button>
      {isModalOpen && <LoginModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
