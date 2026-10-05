import {
  login as loginRequest,
  register as registerRequest,
  fetchMe
} from "../api/authApi.js";


/*
 * Пока сохраняем историческое имя ключа.
 *
 * Некоторые существующие админские функции
 * читают его напрямую из localStorage.
 * Поэтому его переименование сейчас могло бы
 * сломать административные запросы.
 */
const ADMIN_TOKEN_STORAGE_KEY =
  "boykovgroup_admin_token";

const USER_TOKEN_STORAGE_KEY =
  "boykovgroup_auth_token";

const ACTIVE_ROLE_STORAGE_KEY =
  "boykovgroup_active_auth_role";


const AUTH_START =
  "auth/start";

const AUTH_SUCCESS =
  "auth/success";

const AUTH_FAIL =
  "auth/fail";

const AUTH_LOGOUT =
  "auth/logout";

const AUTH_CLEAR_ERROR =
  "auth/clearError";


const initialState = {
  token: null,
  user: null,
  isRestoring: true,
  isAuthenticating: false,
  error: null
};


export function authReducer(
  state = initialState,
  action
) {
  switch (
    action.type
  ) {
    case AUTH_START:
      return {
        ...state,
        isAuthenticating:
          true,
        error:
          null
      };

    case AUTH_SUCCESS:
      return {
        ...state,
        isAuthenticating:
          false,
        isRestoring:
          false,
        token:
          action.payload.token,
        user:
          action.payload.user,
        error:
          null
      };

    case AUTH_FAIL:
      return {
        ...state,
        isAuthenticating:
          false,
        isRestoring:
          false,
        token:
          null,
        user:
          null,
        error:
          action.payload
      };

    case AUTH_LOGOUT:
      return {
        ...state,
        token:
          null,
        user:
          null,
        isRestoring:
          false,
        isAuthenticating:
          false,
        error:
          null
      };

    case AUTH_CLEAR_ERROR:
      return {
        ...state,
        error:
          null
      };

    default:
      return state;
  }
}


const authStart =
  () => ({
    type:
      AUTH_START
  });

const authSuccess =
  (
    token,
    user
  ) => ({
    type:
      AUTH_SUCCESS,
    payload: {
      token,
      user
    }
  });

const authFail =
  (message) => ({
    type:
      AUTH_FAIL,
    payload:
      message
  });


function persistAuth(
  data,
  dispatch
) {

  const role =
    data.user?.role ===
      "admin"
      ? "admin"
      : "user";


  const storageKey =
    role ===
      "admin"
      ? ADMIN_TOKEN_STORAGE_KEY
      : USER_TOKEN_STORAGE_KEY;


  localStorage.setItem(
    storageKey,
    data.token
  );


  sessionStorage.setItem(
    ACTIVE_ROLE_STORAGE_KEY,
    role
  );


  dispatch(
    authSuccess(
      data.token,
      data.user
    )
  );

}


/*
 * Вход администратора или пользователя.
 */
export function login(
  loginValue,
  password
) {
  return async (
    dispatch
  ) => {
    dispatch(
      authStart()
    );

    try {
      const data =
        await loginRequest(
          loginValue,
          password
        );

      persistAuth(
        data,
        dispatch
      );

      return true;
    } catch (error) {
      dispatch(
        authFail(
          error.message
        )
      );

      return false;
    }
  };
}


/*
 * Регистрация обычного пользователя.
 * Backend сразу возвращает JWT,
 * поэтому регистрация автоматически
 * авторизует пользователя.
 */
export function register(
  registration
) {

  return async (
    dispatch
  ) => {

    dispatch(
      authStart()
    );


    try {

      const data =
        await registerRequest(
          registration
        );


      persistAuth(
        data,
        dispatch
      );


      return true;

    }
    catch (error) {

      dispatch(
        authFail(
          error.message
        )
      );


      return false;

    }

  };

}


export function clearAuthError() {
  return {
    type:
      AUTH_CLEAR_ERROR
  };
}


export function logout() {

  return (
    dispatch
  ) => {

    const role =
      sessionStorage.getItem(
        ACTIVE_ROLE_STORAGE_KEY
      );


    if (
      role ===
      "user"
    ) {

      localStorage.removeItem(
        USER_TOKEN_STORAGE_KEY
      );

    }
    else {

      localStorage.removeItem(
        ADMIN_TOKEN_STORAGE_KEY
      );

    }


    sessionStorage.removeItem(
      ACTIVE_ROLE_STORAGE_KEY
    );


    dispatch({
      type:
        AUTH_LOGOUT
    });

  };

}


/*
 * Восстановление сессии после F5.
 * Работает одинаково для admin и user.
 */
export function restoreSession() {

  return async (
    dispatch
  ) => {

    const activeRole =
      sessionStorage.getItem(
        ACTIVE_ROLE_STORAGE_KEY
      );


    const token =
      activeRole ===
        "user"
        ? localStorage.getItem(
            USER_TOKEN_STORAGE_KEY
          )

        : activeRole ===
            "admin"
          ? localStorage.getItem(
              ADMIN_TOKEN_STORAGE_KEY
            )

          : (
              localStorage.getItem(
                ADMIN_TOKEN_STORAGE_KEY
              )
              ||
              localStorage.getItem(
                USER_TOKEN_STORAGE_KEY
              )
            );


    if (!token) {

      dispatch({
        type:
          AUTH_LOGOUT
      });

      return;

    }


    try {

      const data =
        await fetchMe(
          token
        );


      const restoredRole =
        data.user?.role ===
          "admin"
          ? "admin"
          : "user";


      sessionStorage.setItem(
        ACTIVE_ROLE_STORAGE_KEY,
        restoredRole
      );


      dispatch(
        authSuccess(
          token,
          data.user
        )
      );

    }
    catch {

      if (
        localStorage.getItem(
          ADMIN_TOKEN_STORAGE_KEY
        ) === token
      ) {

        localStorage.removeItem(
          ADMIN_TOKEN_STORAGE_KEY
        );

      }


      if (
        localStorage.getItem(
          USER_TOKEN_STORAGE_KEY
        ) === token
      ) {

        localStorage.removeItem(
          USER_TOKEN_STORAGE_KEY
        );

      }


      sessionStorage.removeItem(
        ACTIVE_ROLE_STORAGE_KEY
      );


      dispatch({
        type:
          AUTH_LOGOUT
      });

    }

  };

}


export const selectAuthToken =
  (state) =>
    state.auth.token;

export const selectAuthUser =
  (state) =>
    state.auth.user;

export const selectIsAdmin =
  (state) =>
    state.auth.user?.role ===
    "admin";

export const selectIsUser =
  (state) =>
    state.auth.user?.role ===
    "user";

export const selectIsAuthenticated =
  (state) =>
    Boolean(
      state.auth.user &&
      state.auth.token
    );

export const selectIsAuthenticating =
  (state) =>
    state.auth.isAuthenticating;

export const selectIsRestoringSession =
  (state) =>
    state.auth.isRestoring;

export const selectAuthError =
  (state) =>
    state.auth.error;
