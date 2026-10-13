import {
  useCallback,
  useEffect,
  useRef
} from "react";

import {
  useDispatch
} from "react-redux";

import {
  searchInstructions
} from "../../../store/instructionsSlice.js";

import {
  PAGE_SIZE
} from "../../../constants.js";


export default function useInfiniteInstructions({

  query,
  page,
  totalPages,

  isSearching,
  isLoadingMore,
  loadMoreError

}) {

  const dispatch =
    useDispatch();


  const loadMoreRef =
    useRef(null);

  const loadMoreLockRef =
    useRef(false);

  const loadMoreArmedRef =
    useRef(true);


  const hasMore =
    page <
    totalPages;


  useEffect(() => {

    loadMoreLockRef.current =
      false;

    loadMoreArmedRef.current =
      true;

  }, [
    query
  ]);


  const loadMore =
    useCallback(
      async () => {

        if (
          !loadMoreArmedRef.current
        ) {
          return;
        }


        if (
          loadMoreLockRef.current ||
          isSearching ||
          isLoadingMore ||
          !hasMore
        ) {
          return;
        }


        loadMoreArmedRef.current =
          false;

        loadMoreLockRef.current =
          true;


        try {

          await dispatch(
            searchInstructions({
              query,

              page:
                page + 1,

              pageSize:
                PAGE_SIZE,

              append:
                true
            })
          );

        }
        finally {

          loadMoreLockRef.current =
            false;

        }

      },
      [
        dispatch,
        query,
        page,
        hasMore,
        isSearching,
        isLoadingMore
      ]
    );


  useEffect(() => {

    const target =
      loadMoreRef.current;


    if (
      !target ||
      !hasMore ||
      loadMoreError
    ) {
      return undefined;
    }


    const observer =
      new IntersectionObserver(
        ([entry]) => {

          if (
            !entry.isIntersecting
          ) {

            loadMoreArmedRef.current =
              true;

            return;

          }


          void loadMore();

        },
        {
          rootMargin:
            "120px 0px",

          threshold:
            0.01
        }
      );


    observer.observe(
      target
    );


    return () => {

      observer.disconnect();

    };

  }, [
    loadMore,
    hasMore,
    loadMoreError
  ]);


  return {
    hasMore,
    loadMore,
    loadMoreRef
  };

}
