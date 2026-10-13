import Loader
  from "../../../../components/Loader/Loader.jsx";

import EmptyState
  from "../../../../components/EmptyState/EmptyState.jsx";

import InstructionSort
  from "../../../../components/InstructionSort/InstructionSort.jsx";

import InstructionList
  from "../../../../components/InstructionList/InstructionList.jsx";

import styles
  from "../../../../App.module.css";


export default function InstructionResults({

  items,
  total,
  query,

  isAdmin,

  isSearching,
  searchError,

  isLoadingMore,
  loadMoreError,
  hasMore,

  deletingId,

  loadMoreRef,

  onLoadMore,
  onDelete,
  onEdit,

  showEmptyState,

  isGenerating,
  generateError,
  onGenerate

}) {

  return (
    <main>

      {
        isSearching &&
        (
          <Loader
            label="Загрузка..."
          />
        )
      }


      {
        !isSearching &&
        searchError &&
        (
          <p
            className={
              styles.error
            }
          >
            Ошибка: {searchError}
          </p>
        )
      }


      {
        !isSearching &&
        !searchError &&
        items.length > 0 &&
        (
          <>

            <div
              className={
                styles.resultsHead
              }
            >

              <span
                className={
                  styles.count
                }
              >
                Всего инструкций: {total}
              </span>

            </div>


            <InstructionSort />


            <InstructionList
              instructions={
                items
              }
              total={
                total
              }
              query={
                query
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
              deletingId={
                deletingId
              }
            />


            <div
              ref={
                loadMoreRef
              }
              className={
                styles.loadMoreZone
              }
              aria-live="polite"
            >

              {
                isLoadingMore &&
                (
                  <span
                    className={
                      styles.loadMoreText
                    }
                  >
                    [ загружаем ещё ]
                  </span>
                )
              }


              {
                !isLoadingMore &&
                loadMoreError &&
                hasMore &&
                (
                  <button
                    type="button"
                    className={
                      styles.loadMoreRetry
                    }
                    onClick={
                      onLoadMore
                    }
                  >
                    [ повторить загрузку ]
                  </button>
                )
              }


              {
                !isLoadingMore &&
                !loadMoreError &&
                !hasMore &&
                (
                  <span
                    className={
                      styles.loadMoreDone
                    }
                  >
                    [ все инструкции загружены ]
                  </span>
                )
              }

            </div>

          </>
        )
      }


      {
        showEmptyState &&
        (
          <EmptyState
            query={
              query
            }
            isAdmin={
              isAdmin
            }
            isGenerating={
              isGenerating
            }
            error={
              generateError
            }
            onGenerate={
              onGenerate
            }
          />
        )
      }

    </main>
  );

}
