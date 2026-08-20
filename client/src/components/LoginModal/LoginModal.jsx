import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { login, selectIsAuthenticating, selectAuthError } from "../../store/authSlice.js";
import styles from "./LoginModal.module.css";

export default function LoginModal({ onClose }) {
  const dispatch = useDispatch();
  const isAuthenticating = useSelector(selectIsAuthenticating);
  const error = useSelector(selectAuthError);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await dispatch(login(loginValue, password));
    if (ok) onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <span className={styles.eyebrow}>// вход_для_администратора</span>
        <h2 className={styles.title}>Вход администратора</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Логин</span>
            <input
              className={styles.input}
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Пароль</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submit} disabled={isAuthenticating}>
            {isAuthenticating ? "Проверяем..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}