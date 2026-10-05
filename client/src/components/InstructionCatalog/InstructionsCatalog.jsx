import {
  useEffect,
  useState
} from "react";

import {
  Link
} from "react-router-dom";

import {
  useSelector
} from "react-redux";

import Header
  from "../Header/Header.jsx";

import Navigation
  from "../Navigation/Navigation.jsx";


import InstructionSort
  from "../InstructionSort/InstructionSort.jsx";

import GeneratedInstructionBadge
  from "../GeneratedInstructionBadge/GeneratedInstructionBadge.jsx";

import {
  selectIsAdmin
} from "../../store/authSlice.js";

import SEO
  from "../SEO/SEO.jsx";

import styles
  from "./InstructionsCatalog.module.css";


const PAGE_SIZE =
  11;


export default function InstructionsCatalog() {

  const isAdmin =
    useSelector(
      selectIsAdmin
    );


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


  return (
    <div
      className={
        styles.page
      }
    >

      <SEO
        title="Инструкции по охране труда | БОЙКОВГРУПП"
        description="Готовые инструкции по охране труда для различных профессий. База документов по охране труда для организаций."
      />


      <div
        className={
          styles.siteHeader
        }
      >

        <Header
          query=""
          onQueryChange={
            () => {}
          }
        />

        <Navigation />

      </div>


      <main
        className={
          styles.content
        }
      >

        <a
          id="boykovCatalogHomeButton"
          className="boykovCatalogHomeButton"
          href="/"
        >
          ← На главную
        </a>


        <h1>
          Инструкции по охране труда
        </h1>


        <p
          className={
            styles.description
          }
        >
          Готовые инструкции по охране труда для работников различных профессий.
        </p>


        {
          loading &&
          (
            <p
              className="catalogLoading"
            >
              Загрузка...
            </p>
          )
        }


        {
          error &&
          (
            <p
              className="catalogError"
            >
              {error}
            </p>
          )
        }


        {
          !loading &&
          !error &&
          (
            <>

              <InstructionSort />


              <div
                className={
                  styles.grid
                }
              >

                {
                  items.map(
                    item => (

                      <Link
                        key={
                          item.id
                        }
                        to={`/instrukciya-po-ohrane-truda/${item.id}`}
                        className={
                          styles.card
                        }
                      >

                        <h2>
                          {item.title}
                        </h2>


                        {
                          isAdmin &&
                          item?.source ===
                            "generated" &&
                          (
                            <GeneratedInstructionBadge />
                          )
                        }


                        <span>
                          Открыть инструкцию →
                        </span>

                      </Link>

                    )
                  )
                }


                <div
                  className="generationCatalogCard generationCatalogStandalone"
                >

                  <div
                    className="generationCatalogEyebrow"
                  >
                    Нужной инструкции нет?
                  </div>

                  <h2
                    className="generationCatalogTitle"
                  >
                    Не нашли нужную инструкцию?
                  </h2>

                  <p
                    className="generationCatalogText"
                  >
                    Сгенерируйте её!
                  </p>

                  <Link
                    to="/srochnaya-generaciya-instrukcii"
                    className="generationCatalogButton"
                  >
                    Сгенерировать
                  </Link>

                </div>

              </div>


              {
                totalPages > 1 &&
                (
                  <nav
                    className="catalogPagination"
                    aria-label="Пагинация инструкций"
                  >

                    <button
                      type="button"
                      className="catalogPaginationArrow"
                      disabled={
                        page === 1
                      }
                      onClick={
                        () =>
                          changePage(
                            page - 1
                          )
                      }
                      aria-label="Предыдущая страница"
                    >
                      ←
                    </button>


                    {
                      paginationItems.map(
                        (
                          item,
                          index
                        ) => (

                          typeof item ===
                            "number"
                            ? (
                                <button
                                  key={`page-${item}`}
                                  type="button"
                                  className={[
                                    "catalogPaginationPage",

                                    item ===
                                      page
                                      ? "catalogPaginationPageActive"
                                      : ""
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={
                                    () =>
                                      changePage(
                                        item
                                      )
                                  }
                                  aria-current={
                                    item ===
                                      page
                                      ? "page"
                                      : undefined
                                  }
                                >
                                  {item}
                                </button>
                              )
                            : (
                                <span
                                  key={`dots-${item}-${index}`}
                                  className="catalogPaginationDots"
                                >
                                  …
                                </span>
                              )

                        )
                      )
                    }


                    <button
                      type="button"
                      className="catalogPaginationArrow"
                      disabled={
                        page ===
                          totalPages
                      }
                      onClick={
                        () =>
                          changePage(
                            page + 1
                          )
                      }
                      aria-label="Следующая страница"
                    >
                      →
                    </button>

                  </nav>
                )
              }

            </>
          )
        }

      </main>

    </div>
  );

}
