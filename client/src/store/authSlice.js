import { login as loginRequest, fetchMe } from "../api/authApi.js";

const TOKEN_STORAGE_KEY = "boykovgroup_admin_token";

const AUTH_START = "auth/start";
const AUTH_SUCCESS = "auth/success";
const AUTH_FAIL = "auth/fail";
const AUTH_LOGOUT = "auth/logout";

const initialState = {
  token: null,
  user: null,
  // isRestoring: true, пока при загрузке страницы не проверили сохранённый
  // токен — до этого момента не знаем, авторизован пользователь или нет.
  isRestoring: true,
  isAuthenticating: false,
  error: null,
};

export function authReducer(state = initialState, action) {
  switch (action.type) {
    case AUTH_START:
      return { ...state, isAuthenticating: true, error: null };

    case AUTH_SUCCESS:
      return {
        ...state,
        isAuthenticating: false,
        isRestoring: false,
        token: action.payload.token,
        user: action.payload.user,
        error: null,
      };

    case AUTH_FAIL:
      return {
        ...state,
        isAuthenticating: false,
        isRestoring: false,
        token: null,
        user: null,
        error: action.payload,
      };

    case AUTH_LOGOUT:
      return { ...state, token: null, user: null, isRestoring: false, error: null };

    default:
      return state;
  }
}

// --- action creators ---
const authStart = () => ({ type: AUTH_START });
const authSuccess = (token, user) => ({ type: AUTH_SUCCESS, payload: { token, user } });
const authFail = (message) => ({ type: AUTH_FAIL, payload: message });

// --- thunks ---

/** Логин админа по паролю. Возвращает true/false — удобно для формы входа. */
export function login(loginValue, password) {
  return async (dispatch) => {
    dispatch(authStart());
    try {
      const data = await loginRequest(loginValue, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      dispatch(authSuccess(data.token, data.user));
      return true;
    } catch (err) {
      dispatch(authFail(err.message));
      return false;
    }
  };
}

export function logout() {
  return (dispatch) => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    dispatch({ type: AUTH_LOGOUT });
  };
}

/** Восстанавливает сессию админа из localStorage при загрузке приложения. */
export function restoreSession() {
  return async (dispatch) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      dispatch({ type: AUTH_LOGOUT });
      return;
    }
    try {
      const data = await fetchMe(token);
      dispatch(authSuccess(token, data.user));
    } catch {
      // токен просрочен/невалиден — тихо разлогиниваем
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      dispatch({ type: AUTH_LOGOUT });
    }
  };
}

// --- selectors ---
export const selectAuthToken = (state) => state.auth.token;
export const selectAuthUser = (state) => state.auth.user;
export const selectIsAdmin = (state) => state.auth.user?.role === "admin";
export const selectIsAuthenticating = (state) => state.auth.isAuthenticating;
export const selectIsRestoringSession = (state) => state.auth.isRestoring;
export const selectAuthError = (state) => state.auth.error;
