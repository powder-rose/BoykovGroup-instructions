import {
  useEffect,
  useState
} from "react";

import {
  useDispatch,
  useSelector
} from "react-redux";

import {
  useDebouncedValue
} from "../../../hooks/useDebouncedValue.js";

import {
  deleteInstruction,
  generateInstruction,
  searchInstructions
} from "../../../store/instructionsSlice.js";

import {
  selectIsAdmin
} from "../../../store/authSlice.js";

import {
  PAGE_SIZE
} from "../../../constants.js";


export default function useHomeInstructions() {

  const dispatch =
    useDispatch();

  const isAdmin =
    useSelector(
      selectIsAdmin
    );


  const [
    queryInput,
    setQueryInput
  ] =
    useState(
      () =>
        new URLSearchParams(
          window.location.search
        ).get("q") ?? ""
    );


  const debouncedQuery =
    useDebouncedValue(
      queryInput,
      350
    );


  const {
    items,
    total,
    page: resultPage,
    totalPages,

    isSearching,
    isLoadingMore,

    searchError,
    loadMoreError,

    isGenerating,
    generateError,

    deletingId
  } =
    useSelector(
      state =>
        state.instructions
    );


  useEffect(() => {

    dispatch(
      searchInstructions({
        query:
          debouncedQuery,

        page:
          1,

        pageSize:
          PAGE_SIZE,

        append:
          false
      })
    );

  }, [
    dispatch,
    debouncedQuery
  ]);


  async function generate() {

    if (!isAdmin) {
      return;
    }


    await dispatch(
      generateInstruction(
        debouncedQuery
      )
    );

  }


  function remove(id) {

    if (!isAdmin) {
      return;
    }


    dispatch(
      deleteInstruction(
        id
      )
    );

  }


  function refresh() {

    dispatch(
      searchInstructions({
        query:
          debouncedQuery,

        page:
          1,

        pageSize:
          PAGE_SIZE
      })
    );

  }


  const showEmptyState =
    !isSearching &&
    !searchError &&
    Boolean(
      debouncedQuery.trim()
    ) &&
    items.length === 0;


  return {
    queryInput,
    setQueryInput,
    debouncedQuery,

    isAdmin,

    items,
    total,
    resultPage,
    totalPages,

    isSearching,
    isLoadingMore,
    searchError,
    loadMoreError,

    isGenerating,
    generateError,
    deletingId,

    showEmptyState,

    generate,
    remove,
    refresh
  };

}
