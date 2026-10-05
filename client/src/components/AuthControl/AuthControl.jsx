import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  useDispatch,
  useSelector
} from "react-redux";

import LoginModal from
  "../LoginModal/LoginModal.jsx";

import {
  logout,
  selectAuthUser,
  selectIsAdmin,
  selectIsRestoringSession
} from "../../store/authSlice.js";

import styles from
  "./AuthControl.module.css";


const USER_TOKEN_KEY =
  "boykovgroup_auth_token";

const AUTH_NEXT_KEY =
  "boykovdocs_auth_next_v1";

const ACTIVE_ROLE_KEY =
  "boykovgroup_active_auth_role";


function safeAuthNext(
  value
) {

  try {

    const target =
      new URL(
        String(
          value ||
          "/account/"
        ),
        window.location.origin
      );


    if (
      target.origin !==
      window.location.origin
    ) {

      return "/account/";

    }


    return (
      target.pathname +
      target.search +
      target.hash
    );

  }
  catch {

    return "/account/";

  }

}


function getUserToken() {

  try {

    return window.localStorage
      .getItem(
        USER_TOKEN_KEY
      );

  }
  catch {

    return null;

  }

}


function clearBrokenUserToken() {

  try {

    window.localStorage
      .removeItem(
        USER_TOKEN_KEY
      );


    if (
      window.sessionStorage
        .getItem(
          ACTIVE_ROLE_KEY
        ) ===
        "user"
    ) {

      window.sessionStorage
        .removeItem(
          ACTIVE_ROLE_KEY
        );

    }

  }
  catch {
    /* storage unavailable */
  }

}


async function verifyUserToken(
  token
) {

  if (!token) {
    return false;
  }


  try {

    const response =
      await fetch(
        "/api/auth/me",
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          },

          cache:
            "no-store"
        }
      );


    if (!response.ok) {
      return false;
    }


    const data =
      await response.json();


    return (
      data?.user?.role ===
      "user"
    );

  }
  catch {

    return false;

  }

}


export default function AuthControl() {

  const dispatch =
    useDispatch();

  const isAdmin =
    useSelector(
      selectIsAdmin
    );

  const user =
    useSelector(
      selectAuthUser
    );

  const isRestoring =
    useSelector(
      selectIsRestoringSession
    );

  const [
    isModalOpen,
    setModalOpen
  ] =
    useState(false);

  const [
    isMenuOpen,
    setMenuOpen
  ] =
    useState(false);

  const dropdownRef =
    useRef(null);


  const authReturnActiveRef =
    useRef(false);

  const authReturnNextRef =
    useRef("/account/");

  const authReturnOpenedRef =
    useRef(false);

  const authReturnRedirectedRef =
    useRef(false);


  useEffect(() => {

    if (!isMenuOpen) {
      return undefined;
    }


    function handleDocumentClick(
      event
    ) {

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {

        setMenuOpen(
          false
        );

      }

    }


    function handleKeyDown(
      event
    ) {

      if (
        event.key ===
        "Escape"
      ) {

        setMenuOpen(
          false
        );

      }

    }


    document.addEventListener(
      "click",
      handleDocumentClick
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      document.removeEventListener(
        "click",
        handleDocumentClick
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, [
    isMenuOpen
  ]);


  useEffect(() => {

    setMenuOpen(
      false
    );

  }, [
    user
  ]);


  /*
   * ==========================================================
   * ACCOUNT AUTH RETURN
   * ==========================================================
   *
   * Раньше это делал отдельный production patch:
   * account-auth-return-20260930.js
   */
  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search
      );


    if (
      params.get(
        "auth"
      ) !==
      "1"
    ) {

      return undefined;

    }


    const next =
      safeAuthNext(
        params.get(
          "next"
        )
      );


    authReturnActiveRef.current =
      true;

    authReturnNextRef.current =
      next;


    try {

      window.sessionStorage
        .setItem(
          AUTH_NEXT_KEY,
          next
        );

    }
    catch {
      /* storage unavailable */
    }


    let cancelled =
      false;


    async function start() {

      const token =
        getUserToken();


      if (
        token &&
        await verifyUserToken(
          token
        )
      ) {

        if (cancelled) {
          return;
        }


        authReturnRedirectedRef.current =
          true;


        let destination =
          next;


        try {

          destination =
            safeAuthNext(
              window.sessionStorage
                .getItem(
                  AUTH_NEXT_KEY
                ) ||
              next
            );


          window.sessionStorage
            .removeItem(
              AUTH_NEXT_KEY
            );

        }
        catch {
          /* storage unavailable */
        }


        window.location.replace(
          destination
        );

        return;

      }


      if (token) {

        clearBrokenUserToken();

      }

    }


    void start();


    return () => {

      cancelled =
        true;

    };

  }, []);


  /*
   * Когда React закончил восстановление сессии
   * и пользователь не авторизован —
   * открываем штатный LoginModal.
   *
   * Один раз, как production patch.
   */
  useEffect(() => {

    if (
      !authReturnActiveRef.current ||
      authReturnRedirectedRef.current ||
      authReturnOpenedRef.current ||
      isRestoring
    ) {

      return;

    }


    /*
     * Если активен admin — production patch
     * тоже не находил пользовательскую кнопку
     * login, поэтому этот случай не меняем.
     */
    if (
      user &&
      user.role !==
        "user"
    ) {

      return;

    }


    if (!user) {

      authReturnOpenedRef.current =
        true;

      setModalOpen(
        true
      );

    }

  }, [
    isRestoring,
    user
  ]);


  /*
   * После успешного login/register Redux уже
   * содержит обычного пользователя.
   * Возвращаем его туда, откуда пришёл auth=1.
   */
  useEffect(() => {

    if (
      !authReturnActiveRef.current ||
      authReturnRedirectedRef.current ||
      user?.role !==
        "user"
    ) {

      return;

    }


    authReturnRedirectedRef.current =
      true;


    let destination =
      authReturnNextRef.current;


    try {

      destination =
        safeAuthNext(
          window.sessionStorage
            .getItem(
              AUTH_NEXT_KEY
            ) ||
          destination
        );


      window.sessionStorage
        .removeItem(
          AUTH_NEXT_KEY
        );

    }
    catch {
      /* storage unavailable */
    }


    window.location.replace(
      destination
    );

  }, [
    user
  ]);


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


  /*
   * Обычный пользователь:
   * нормальный React dropdown вместо
   * production MutationObserver patch.
   */
  if (user) {

    const accountName =
      user.email ||
      user.login ||
      "аккаунт";


    return (
      <div
        ref={
          dropdownRef
        }
        className={
          styles.accountDropdown
        }
      >

        <button
          type="button"
          className={
            styles.accountTrigger
          }
          aria-haspopup="menu"
          aria-expanded={
            isMenuOpen
          }
          onClick={
            (event) => {

              event.stopPropagation();

              setMenuOpen(
                current =>
                  !current
              );

            }
          }
        >

          <span
            className={
              styles.accountTriggerEmail
            }
          >
            [ {accountName} ]
          </span>


          <span
            className={
              styles.accountTriggerChevron
            }
            aria-hidden="true"
          >
            ▾
          </span>

        </button>


        <div
          className={
            styles.accountMenu
          }
          hidden={
            !isMenuOpen
          }
          role="menu"
        >

          <div
            className={
              styles.accountMenuHead
            }
          >

            <div
              className={
                styles.accountMenuLabel
              }
            >
              АККАУНТ
            </div>


            <div
              className={
                styles.accountMenuEmail
              }
            >
              {accountName}
            </div>

          </div>


          <div
            className={
              styles.accountMenuDivider
            }
          />


          <a
            href="/account/"
            className={
              styles.accountMenuItem
            }
            role="menuitem"
            onClick={
              () =>
                setMenuOpen(
                  false
                )
            }
          >

            <span>
              Личный кабинет
            </span>


            <span
              className={
                styles.accountMenuArrow
              }
            >
              →
            </span>

          </a>


          <button
            type="button"
            className={[
              styles.accountMenuItem,
              styles.accountMenuLogout
            ]
              .filter(Boolean)
              .join(" ")}
            role="menuitem"
            onClick={
              () => {

                setMenuOpen(
                  false
                );

                dispatch(
                  logout()
                );

              }
            }
          >
            Выйти
          </button>

        </div>

      </div>
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
