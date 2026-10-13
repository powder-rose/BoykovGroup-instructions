import {
  useEffect,
  useState
} from "react";


const PAGE_SIZE =
  11;


export default function useInstructionsCatalog() {

  const [
    items,
    setItems
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    page,
    setPage
  ] = useState(1);

  const [
    totalPages,
    setTotalPages
  ] = useState(1);

  const [
    error,
    setError
  ] = useState("");


  useEffect(() => {

    let cancelled =
      false;


    async function load() {

      try {

        setLoading(
          true
        );

        setError(
          ""
        );


        const response =
          await fetch(
            `/api/instructions?page=${page}&pageSize=${PAGE_SIZE}&sort=${new URLSearchParams(window.location.search).get("sort") === "popular" ? "popular" : "newest"}`
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
            "Не удалось загрузить инструкции."
          );

        }


        if (!cancelled) {

          setItems(
            Array.isArray(
              data?.items
            )
              ? data.items
              : []
          );


          setTotalPages(
            Math.max(
              1,
              Number(
                data?.totalPages
              ) || 1
            )
          );

        }

      }
      catch(loadError) {

        if (!cancelled) {

          setError(
            loadError?.message ||
            "Не удалось загрузить инструкции."
          );

        }

      }
      finally {

        if (!cancelled) {

          setLoading(
            false
          );

        }

      }

    }


    load();


    return () => {

      cancelled =
        true;

    };

  }, [
    page
  ]);


  function changePage(
    nextPage
  ) {

    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === page
    ) {

      return;

    }


    setPage(
      nextPage
    );


    window.scrollTo({
      top:
        0,

      behavior:
        "smooth"
    });

  }


  const paginationItems =
    (() => {

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
        page > 4
      ) {

        result.push(
          "left"
        );

      }


      const start =
        Math.max(
          2,
          page - 2
        );


      const end =
        Math.min(
          totalPages - 1,
          page + 2
        );


      for (
        let current =
          start;

        current <=
          end;

        current +=
          1
      ) {

        result.push(
          current
        );

      }


      if (
        page <
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

    })();


  return {
    items,
    loading,
    page,
    totalPages,
    error,
    paginationItems,
    changePage
  };

}
