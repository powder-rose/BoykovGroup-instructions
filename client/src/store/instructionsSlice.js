import {
  searchInstructions as searchRequest,
  getInstruction as getInstructionRequest,
  generateInstruction as generateRequest,
  uploadInstruction as uploadRequest,
  deleteInstruction as deleteRequest,
} from "../api/instructionsApi.js";
import { selectAuthToken } from "./authSlice.js";
import { PAGE_SIZE } from "../constants.js";

const SEARCH_START = "instructions/searchStart";
const SEARCH_SUCCESS = "instructions/searchSuccess";
const SEARCH_FAIL = "instructions/searchFail";

const SELECT_START = "instructions/selectStart";
const SELECT_SUCCESS = "instructions/selectSuccess";
const SELECT_FAIL = "instructions/selectFail";
const SELECT_CLEAR = "instructions/selectClear";

const GENERATE_START = "instructions/generateStart";
const GENERATE_SUCCESS = "instructions/generateSuccess";
const GENERATE_FAIL = "instructions/generateFail";

const UPLOAD_START = "instructions/uploadStart";
const UPLOAD_SUCCESS = "instructions/uploadSuccess";
const UPLOAD_FAIL = "instructions/uploadFail";

const DELETE_START = "instructions/deleteStart";
const DELETE_SUCCESS = "instructions/deleteSuccess";
const DELETE_FAIL = "instructions/deleteFail";

const initialState = {
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
  query: "",
  isSearching: true,
  searchError: null,

  selected: null,
  isLoadingSelected: false,
  selectedError: null,

  isGenerating: false,
  generateError: null,

  isUploading: false,
  uploadError: null,

  deletingId: null,
  deleteError: null,
};

export function instructionsReducer(state = initialState, action) {
  switch (action.type) {
    case SEARCH_START:
      return { ...state, isSearching: true, searchError: null };

    case SEARCH_SUCCESS:
      return {
        ...state,
        isSearching: false,
        items: action.payload.items,
        total: action.payload.total,
        page: action.payload.page,
        totalPages: action.payload.totalPages,
        query: action.payload.query,
      };

    case SEARCH_FAIL:
      return { ...state, isSearching: false, searchError: action.payload };

    case SELECT_START:
      return { ...state, isLoadingSelected: true, selectedError: null, selected: null };

    case SELECT_SUCCESS:
      return { ...state, isLoadingSelected: false, selected: action.payload };

    case SELECT_FAIL:
      return { ...state, isLoadingSelected: false, selectedError: action.payload };

    case SELECT_CLEAR:
      return { ...state, selected: null, selectedError: null, isLoadingSelected: false };

    case GENERATE_START:
      return { ...state, isGenerating: true, generateError: null };

    case GENERATE_SUCCESS:
      return { ...state, isGenerating: false, selected: action.payload };

    case GENERATE_FAIL:
      return { ...state, isGenerating: false, generateError: action.payload };

    case UPLOAD_START:
      return { ...state, isUploading: true, uploadError: null };

    case UPLOAD_SUCCESS:
      return { ...state, isUploading: false, selected: action.payload };

    case UPLOAD_FAIL:
      return { ...state, isUploading: false, uploadError: action.payload };

    case DELETE_START:
      return { ...state, deletingId: action.payload, deleteError: null };

    case DELETE_SUCCESS: {
      const remaining = state.items.filter((item) => item.id !== action.payload);
      return {
        ...state,
        deletingId: null,
        items: remaining,
        total: Math.max(0, state.total - 1),
        selected: state.selected?.id === action.payload ? null : state.selected,
      };
    }

    case DELETE_FAIL:
      return { ...state, deletingId: null, deleteError: action.payload };

    default:
      return state;
  }
}

// --- thunks ---

/** Поиск инструкций на сервере: клиент передаёт только текст запроса и страницу. */
export function searchInstructions({ query = "", page = 1, pageSize = PAGE_SIZE } = {}) {
  return async (dispatch) => {
    dispatch({ type: SEARCH_START });
    try {
      const data = await searchRequest({ query, page, pageSize });
      dispatch({ type: SEARCH_SUCCESS, payload: data });
    } catch (err) {
      dispatch({ type: SEARCH_FAIL, payload: err.message });
    }
  };
}

export function fetchInstruction(id) {
  return async (dispatch) => {
    dispatch({ type: SELECT_START });
    try {
      const data = await getInstructionRequest(id);
      dispatch({ type: SELECT_SUCCESS, payload: data });
    } catch (err) {
      dispatch({ type: SELECT_FAIL, payload: err.message });
    }
  };
}

export function clearSelectedInstruction() {
  return { type: SELECT_CLEAR };
}

/**
 * Генерация недостающей инструкции через YandexGPT.
 * Сервер сам отклонит запрос без валидного токена админа — здесь
 * просто подкладываем токен из состояния, если он есть.
 */
export function generateInstruction(profession) {
  return async (dispatch, getState) => {
    dispatch({ type: GENERATE_START });
    try {
      const token = selectAuthToken(getState());
      const data = await generateRequest(profession, token);
      dispatch({ type: GENERATE_SUCCESS, payload: data });
      const { query } = getState().instructions;
      dispatch(searchInstructions({ query, page: 1, pageSize: PAGE_SIZE }));
      return data;
    } catch (err) {
      dispatch({ type: GENERATE_FAIL, payload: err.message });
      return null;
    }
  };
}

/**
 * Загрузка собственной инструкции админа — файлом (pdf/docx/txt/md) или
 * текстом вручную. formData собирает вызывающий компонент (title,
 * profession и file/content).
 */
export function uploadInstruction(formData) {
  return async (dispatch, getState) => {
    dispatch({ type: UPLOAD_START });
    try {
      const token = selectAuthToken(getState());
      const data = await uploadRequest(formData, token);
      dispatch({ type: UPLOAD_SUCCESS, payload: data });
      const { query } = getState().instructions;
      dispatch(searchInstructions({ query, page: 1, pageSize: PAGE_SIZE }));
      return data;
    } catch (err) {
      dispatch({ type: UPLOAD_FAIL, payload: err.message });
      return null;
    }
  };
}

/** Удаление инструкции. Доступно только админу. */
export function deleteInstruction(id) {
  return async (dispatch, getState) => {
    dispatch({ type: DELETE_START, payload: id });
    try {
      const token = selectAuthToken(getState());
      await deleteRequest(id, token);
      dispatch({ type: DELETE_SUCCESS, payload: id });
    } catch (err) {
      dispatch({ type: DELETE_FAIL, payload: err.message });
    }
  };
}

// --- selectors ---
export const selectInstructionsState = (state) => state.instructions;