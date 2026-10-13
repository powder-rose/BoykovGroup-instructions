import {
  useDispatch
} from "react-redux";
import LoginModal from
  "../LoginModal/LoginModal.jsx";

import {
  logout
} from "../../store/authSlice.js";

import AuthUserMenu
  from "./AuthUserMenu.jsx";

import useAuthControl
  from "./hooks/useAuthControl.js";

import styles from
  "./AuthControl.module.css";


export default function AuthControl() {

  const dispatch =
    useDispatch();

  const {
    isAdmin,
    user,
    isRestoring,
    isModalOpen,
    setModalOpen,
    isMenuOpen,
    setMenuOpen,
    dropdownRef
  } =
    useAuthControl();


  if (isRestoring) {
    return null;
  }


  /*
   * Админскую панель не меняем.
   */
  if (
    user &&
    isAdmin
  ) {

    return (
      <div
        className={
          styles.wrapper
        }
      >

        <span
          className={
            styles.badge
          }
        >
          [ админ: {user.login} ]
        </span>


        <button
          type="button"
          className={
            styles.logoutBtn
          }
          onClick={
            () =>
              dispatch(
                logout()
              )
          }
        >
          выйти
        </button>

      </div>
    );

  }


  if (user) {

    return (
      <AuthUserMenu
        user={
          user
        }
        isMenuOpen={
          isMenuOpen
        }
        setMenuOpen={
          setMenuOpen
        }
        dropdownRef={
          dropdownRef
        }
        onLogout={
          () =>
            dispatch(
              logout()
            )
        }
      />
    );

  }


  return (
    <>

      <button
        type="button"
        className={
          styles.loginBtn
        }
        onClick={
          () =>
            setModalOpen(
              true
            )
        }
      >
        войти / регистрация
      </button>


      {
        isModalOpen &&
        (
          <LoginModal
            onClose={
              () =>
                setModalOpen(
                  false
                )
            }
          />
        )
      }

    </>
  );

}
