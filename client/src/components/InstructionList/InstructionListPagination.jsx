import styles
  from "./InstructionListPagination.module.css";


export default function InstructionListPagination({

  currentPage,
  totalPages,
  paginationItems,
  isPageLoading,
  paginationError,
  onChangePage

}) {

  return (
    <>

      {
        paginationError &&
        (
          <p
            className={styles.error}
          >
            {paginationError}
          </p>
        )
      }


      {
        totalPages > 1 &&
        (
          <nav
            className={styles.pagination}
            aria-label="Страницы каталога инструкций"
          >

            <button
              type="button"
              className={styles.arrow}
              disabled={
                currentPage === 1 ||
                isPageLoading
              }
              onClick={
                () =>
                  onChangePage(
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
                            styles.page,

                            item ===
                              currentPage
                              ? styles.active
                              : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={
                            () =>
                              onChangePage(
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
                          className={styles.dots}
                        >
                          …
                        </span>
                      )

                )
              )
            }


            <button
              type="button"
              className={styles.arrow}
              disabled={
                currentPage ===
                  totalPages ||
                isPageLoading
              }
              onClick={
                () =>
                  onChangePage(
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
            className={styles.loading}
          >
            Загрузка...
          </div>
        )
      }

    </>
  );

}
