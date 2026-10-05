import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  Link
} from "react-router-dom";

import InstructionButton
  from "../InstructionButton/InstructionButton.jsx";

import cardStyles
  from "../InstructionButton/InstructionButton.module.css";

import styles
  from "./InstructionList.module.css";


const PAGE_SIZE =
  11;


function RevealItem({
  children,
  delay = 0
}) {

  const itemRef =
    useRef(null);

  const [
    isVisible,
    setIsVisible
  ] = useState(false);


  useEffect(() => {

    const node =
      itemRef.current;


    if (!node) {
      return undefined;
    }


    const prefersReducedMotion =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;


    if (
      prefersReducedMotion ||
      typeof IntersectionObserver ===
        "undefined"
    ) {

      setIsVisible(
        true
      );

      return undefined;

    }


    const observer =
      new IntersectionObserver(
        ([entry]) => {

          if (
            !entry.isIntersecting
          ) {

            return;

          }


          setIsVisible(
            true
          );


          observer.unobserve(
            entry.target
          );

        },

        {
          threshold:
            0.06,

          rootMargin:
            "0px 0px -2% 0px"
        }
      );


    observer.observe(
      node
    );


    return () => {

      observer.disconnect();

    };

  }, []);


  return (
    <li
      ref={
        itemRef
      }
      className={[
        styles.item,

        isVisible
          ? styles.visible
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--reveal-delay":
          `${delay}ms`
      }}
    >
      {children}
    </li>
  );

}


export default function InstructionList({
  instructions,
  total = 0,
  query = "",
  isAdmin,
  onDelete,
  deletingId,
  onEdit
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


  return (
    <>

      <ul
        className={
          styles.list
        }
      >

        {
          visibleItems.map(
            (
              instruction,
              index
            ) => (

              <RevealItem
                key={
                  instruction.id
                }
                delay={
                  (
                    index % 3
                  )
                  *
                  90
                }
              >

                <InstructionButton
                  instruction={
                    instruction
                  }
                  isAdmin={
                    isAdmin
                  }
                  onDelete={
                    onDelete
                  }
                  onEdit={
                    onEdit
                  }
                  isDeleting={
                    deletingId ===
                    instruction.id
                  }
                />

              </RevealItem>

            )
          )
        }


        <RevealItem
          key="generation-card"
          delay={
            (
              visibleItems.length %
              3
            )
            *
            90
          }
        >

          <div
            className={`${cardStyles.card} generationListCard boykovCardSearchShadow`}
          >

            <div
              className={`${cardStyles.clickArea} generationListCardInner`}
            >

              <span
                className={`${cardStyles.body} generationListBody`}
              >

                <span
                  className="generationListEyebrow"
                >
                  [ своя инструкция ]
                </span>


                <span
                  className={`${cardStyles.title} generationListTitle`}
                >
                  Не нашли нужную инструкцию?
                </span>


                <span
                  className="generationListText"
                >
                  Создадим её за 2 минуты!
                </span>


                <Link
                  to="/srochnaya-generaciya-instrukcii"
                  className="generationListButton"
                >
                  Сгенерировать
                </Link>

              </span>

            </div>

          </div>

        </RevealItem>

      </ul>


      {
        paginationError &&
        (
          <p
            className="realPaginationError"
          >
            {paginationError}
          </p>
        )
      }


      {
        totalPages > 1 &&
        (
          <nav
            className="realCatalogPagination"
            aria-label="Страницы каталога инструкций"
          >

            <button
              type="button"
              className="realPaginationArrow"
              disabled={
                currentPage === 1 ||
                isPageLoading
              }
              onClick={
                () =>
                  changePage(
                    currentPage - 1
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
                          disabled={
                            isPageLoading
                          }
                          className={[
                            "realPaginationPage",

                            item ===
                              currentPage
                              ? "realPaginationPageActive"
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
                              currentPage
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
                          className="realPaginationDots"
                        >
                          …
                        </span>
                      )

                )
              )
            }


            <button
              type="button"
              className="realPaginationArrow"
              disabled={
                currentPage ===
                  totalPages ||
                isPageLoading
              }
              onClick={
                () =>
                  changePage(
                    currentPage + 1
                  )
              }
              aria-label="Следующая страница"
            >
              →
            </button>

          </nav>
        )
      }


      {
        isPageLoading &&
        (
          <div
            className="realPaginationLoading"
          >
            Загрузка...
          </div>
        )
      }

    </>
  );

}
