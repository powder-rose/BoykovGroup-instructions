import { login as loginRequest, register as registerRequest, fetchMe } from '../api/authApi.js';
import {
  clearCompanyProfileOnboarding,
  markCompanyProfileOnboarding,
  pendingCompanyProfileUserId,
} from '../lib/companyProfileOnboarding.js';

/*
 * Пока сохраняем историческое имя ключа.
 *
 * Некоторые существующие админские функции
 * читают его напрямую из localStorage.
 * Поэтому его переименование сейчас могло бы
 * сломать административные запросы.
 */
const ADMIN_TOKEN_STORAGE_KEY = 'boykovgroup_admin_token';

const USER_TOKEN_STORAGE_KEY = 'boykovgroup_auth_token';

const ACTIVE_ROLE_STORAGE_KEY = 'boykovgroup_active_auth_role';

const AUTH_START = 'auth/start';

const AUTH_SUCCESS = 'auth/success';

const AUTH_FAIL = 'auth/fail';

const AUTH_LOGOUT = 'auth/logout';

const AUTH_CLEAR_ERROR = 'auth/clearError';
const COMPANY_ONBOARDING_COMPLETE = 'auth/companyOnboardingComplete';

const initialState = {
  token: null,
  user: null,
  isRestoring: true,
  isAuthenticating: false,
  error: null,
  companyOnboardingUserId: null,
  companyRegistrationNotice: '',
};

export function authReducer(state = initialState, action) {
  switch (action.type) {
    case AUTH_START:
      return {
        ...state,
        isAuthenticating: true,
        error: null,
      };

    case AUTH_SUCCESS:
      return {
        ...state,
        isAuthenticating: false,
        isRestoring: false,
        token: action.payload.token,
        user: action.payload.user,
        error: null,
        companyOnboardingUserId: action.payload.companyOnboardingUserId,
        companyRegistrationNotice: action.payload.companyRegistrationNotice,
      };

    case AUTH_FAIL:
      return {
        ...state,
        isAuthenticating: false,
        isRestoring: false,
        token: null,
        user: null,
        error: action.payload,
        companyOnboardingUserId: null,
        companyRegistrationNotice: '',
      };

    case AUTH_LOGOUT:
      return {
        ...state,
        token: null,
        user: null,
        isRestoring: false,
        isAuthenticating: false,
        error: null,
        companyOnboardingUserId: null,
        companyRegistrationNotice: '',
      };

    case AUTH_CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case COMPANY_ONBOARDING_COMPLETE:
      if (String(state.user?.id) !== action.payload) return state;
      return {
        ...state,
        companyOnboardingUserId: null,
        companyRegistrationNotice: '',
      };

    default:
      return state;
  }
}

const authStart = () => ({
  type: AUTH_START,
});

const authSuccess = (token, user, registration = null) => ({
  type: AUTH_SUCCESS,
  payload: {
    token,
    user,
    companyOnboardingUserId:
      user?.role === 'user' &&
      user.id &&
      (registration || pendingCompanyProfileUserId() === String(user.id))
        ? String(user.id)
        : null,
    companyRegistrationNotice:
      user?.role === 'user' && registration
        ? user.emailVerified === true || registration.verificationEmailSent === false
          ? 'Регистрация завершена.'
          : 'Регистрация завершена. Подтвердите e-mail по ссылке из письма, чтобы скачивать PDF.'
        : '',
  },
});

const authFail = message => ({
  type: AUTH_FAIL,
  payload: message,
});

function persistAuth(data, dispatch, registration = false) {
  const role = data.user?.role === 'admin' ? 'admin' : 'user';

  const storageKey = role === 'admin' ? ADMIN_TOKEN_STORAGE_KEY : USER_TOKEN_STORAGE_KEY;

  localStorage.setItem(storageKey, data.token);

  sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);

  if (registration && role === 'user') markCompanyProfileOnboarding(data.user?.id);

  dispatch(authSuccess(data.token, data.user, registration ? data : null));
}

/*
 * Вход администратора или пользователя.
 */
export function login(loginValue, password) {
  return async dispatch => {
    dispatch(authStart());

    try {
      const data = await loginRequest(loginValue, password);

      persistAuth(data, dispatch);

      return true;
    } catch (error) {
      dispatch(authFail(error.message));

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
export function register(registration) {
  return async dispatch => {
    dispatch(authStart());

    try {
      const data = await registerRequest(registration);

      persistAuth(data, dispatch, true);

      return data;
    } catch (error) {
      dispatch(authFail(error.message));

      return false;
    }
  };
}

export function clearAuthError() {
  return {
    type: AUTH_CLEAR_ERROR,
  };
}

export function completeCompanyProfileOnboarding(userId) {
  return dispatch => {
    clearCompanyProfileOnboarding(userId);
    dispatch({ type: COMPANY_ONBOARDING_COMPLETE, payload: String(userId) });
  };
}

export function logout() {
  return dispatch => {
    const role = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);

    if (role === 'user') {
      localStorage.removeItem(USER_TOKEN_STORAGE_KEY);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }

    sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);

    dispatch({
      type: AUTH_LOGOUT,
    });
  };
}

/*
 * Восстановление сессии после F5.
 * Работает одинаково для admin и user.
 */
export function restoreSession() {
  return async dispatch => {
    const activeRole = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);

    const token =
      activeRole === 'user'
        ? localStorage.getItem(USER_TOKEN_STORAGE_KEY)
        : activeRole === 'admin'
          ? localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
          : localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ||
            localStorage.getItem(USER_TOKEN_STORAGE_KEY);

    if (!token) {
      dispatch({
        type: AUTH_LOGOUT,
      });

      return;
    }

    try {
      const data = await fetchMe(token);

      const restoredRole = data.user?.role === 'admin' ? 'admin' : 'user';

      sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, restoredRole);

      dispatch(authSuccess(token, data.user));
    } catch {
      if (localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) === token) {
        localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      }

      if (localStorage.getItem(USER_TOKEN_STORAGE_KEY) === token) {
        localStorage.removeItem(USER_TOKEN_STORAGE_KEY);
      }

      sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);

      dispatch({
        type: AUTH_LOGOUT,
      });
    }
  };
}

export const selectAuthToken = state => state.auth.token;

export const selectAuthUser = state => state.auth.user;

export const selectIsAdmin = state => state.auth.user?.role === 'admin';

export const selectIsUser = state => state.auth.user?.role === 'user';

export const selectIsAuthenticated = state => Boolean(state.auth.user && state.auth.token);

export const selectIsAuthenticating = state => state.auth.isAuthenticating;

export const selectIsRestoringSession = state => state.auth.isRestoring;

export const selectAuthError = state => state.auth.error;

export const selectCompanyProfileOnboardingPending = state =>
  state.auth.user?.role === 'user' &&
  Boolean(state.auth.companyOnboardingUserId) &&
  state.auth.companyOnboardingUserId === String(state.auth.user.id);

export const selectCompanyRegistrationNotice = state => state.auth.companyRegistrationNotice;
