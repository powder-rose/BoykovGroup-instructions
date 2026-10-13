import styles
  from "./InstructionsCatalog.module.css";


export default function InstructionsCatalogPagination({

  page,
  totalPages,
  paginationItems,
  onChangePage

}) {

  if (
    totalPages <= 1
  ) {

    return null;

  }


  return (
    <nav
      className={styles.pagination}
      aria-label="Пагинация инструкций"
    >

      <button
        type="button"
        className={styles.paginationArrow}
        disabled={
          page === 1
        }
        onClick={
          () =>
            onChangePage(
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
                      styles.paginationPage,

                      item ===
                        page
                        ? styles.paginationPageActive
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
                    className={styles.paginationDots}
                  >
                    …
                  </span>
                )

          )
        )
      }


      <button
        type="button"
        className={styles.paginationArrow}
        disabled={
          page ===
            totalPages
        }
        onClick={
          () =>
            onChangePage(
              page + 1
            )
        }
        aria-label="Следующая страница"
      >
        →
      </button>

    </nav>
  );

}
