import {
  useEffect,
  useState
} from "react";


const PAGE_SIZE =
  11;


export default function useInstructionListPagination({

  instructions,
  total,
  query

}) {

  const [
    currentPage,
    setCurrentPage
  ] = useState(1);

  const [
    visibleItems,
    setVisibleItems
  ] = useState(
    Array.isArray(
      instructions
    )
      ? instructions.slice(
          0,
          PAGE_SIZE
        )
      : []
  );

  const [
    isPageLoading,
    setIsPageLoading
  ] = useState(false);

  const [
    paginationError,
    setPaginationError
  ] = useState("");


  const totalPages =
    Math.max(
      1,

      Math.ceil(
        (
          Number(total) ||
          (
            Array.isArray(
              instructions
            )
              ? instructions.length
              : 0
          )
        )
        /
        PAGE_SIZE
      )
    );


  useEffect(() => {

    setCurrentPage(
      1
    );

    setPaginationError(
      ""
    );

  }, [
    query
  ]);


  useEffect(() => {

    if (
      currentPage === 1 &&
      Array.isArray(
        instructions
      )
    ) {

      setVisibleItems(
        instructions.slice(
          0,
          PAGE_SIZE
        )
      );

    }

  }, [
    instructions,
    currentPage
  ]);


  async function changePage(
    nextPage
  ) {

    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === currentPage ||
      isPageLoading
    ) {

      return;

    }


    setIsPageLoading(
      true
    );

    setPaginationError(
      ""
    );


    try {

      if (
        nextPage === 1
      ) {

        setVisibleItems(
          Array.isArray(
            instructions
          )
            ? instructions.slice(
                0,
                PAGE_SIZE
              )
            : []
        );


        setCurrentPage(
          1
        );

      }
      else {

        const params =
          new URLSearchParams({
            q:
              query || "",

            page:
              String(
                nextPage
              ),

            pageSize:
              String(
                PAGE_SIZE
              ),

            sort:
              new URLSearchParams(
                window.location.search
              ).get("sort") ===
                "popular"
                ? "popular"
                : "newest"
          });


        const response =
          await fetch(
            `/api/instructions?${params.toString()}`
          );


        const data =
          await response
            .json()
            .catch(
              () => ({})
            );


        if (!response.ok) {

          throw new Error(
            data?.error ||
            "Не удалось загрузить страницу."
          );

        }


        setVisibleItems(
          Array.isArray(
            data?.items
          )
            ? data.items
            : []
        );


        setCurrentPage(
          nextPage
        );

      }


      window.scrollTo({
        top:
          0,

        behavior:
          "smooth"
      });

    }
    catch(loadError) {

      setPaginationError(
        loadError?.message ||
        "Не удалось загрузить страницу."
      );

    }
    finally {

      setIsPageLoading(
        false
      );

    }

  }


  function buildPaginationItems() {

    if (
      totalPages <= 7
    ) {

      return Array.from(
        {
          length:
            totalPages
        },

        (
          _,
          index
        ) =>
          index + 1
      );

    }


    const result = [
      1
    ];


    if (
      currentPage > 4
    ) {

      result.push(
        "left"
      );

    }


    const start =
      Math.max(
        2,
        currentPage - 2
      );


    const end =
      Math.min(
        totalPages - 1,
        currentPage + 2
      );


    for (
      let page =
        start;

      page <=
        end;

      page +=
        1
    ) {

      result.push(
        page
      );

    }


    if (
      currentPage <
      totalPages - 3
    ) {

      result.push(
        "right"
      );

    }


    result.push(
      totalPages
    );


    return result;

  }


  const paginationItems =
    buildPaginationItems();


  return {
    currentPage,
    visibleItems,
    isPageLoading,
    paginationError,
    totalPages,
    paginationItems,
    changePage
  };

}
