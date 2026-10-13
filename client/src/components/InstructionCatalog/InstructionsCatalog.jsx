import {
  useSelector
} from "react-redux";

import Header
  from "../Header/Header.jsx";

import Navigation
  from "../Navigation/Navigation.jsx";


import InstructionSort
  from "../InstructionSort/InstructionSort.jsx";

import {
  selectIsAdmin
} from "../../store/authSlice.js";

import SEO
  from "../SEO/SEO.jsx";

import InstructionsCatalogGrid
  from "./InstructionsCatalogGrid.jsx";

import InstructionsCatalogPagination
  from "./InstructionsCatalogPagination.jsx";

import useInstructionsCatalog
  from "./hooks/useInstructionsCatalog.js";

import styles
  from "./InstructionsCatalog.module.css";


export default function InstructionsCatalog() {

  const isAdmin =
    useSelector(
      selectIsAdmin
    );


  const {
    items,
    loading,
    page,
    totalPages,
    error,
    paginationItems,
    changePage
  } =
    useInstructionsCatalog();


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
          className={
            styles.homeButton
          }
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
              className={styles.catalogLoading}
            >
              Загрузка...
            </p>
          )
        }


        {
          error &&
          (
            <p
              className={styles.catalogError}
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


              <InstructionsCatalogGrid
                items={
                  items
                }
                isAdmin={
                  isAdmin
                }
              />


              <InstructionsCatalogPagination
                page={
                  page
                }
                totalPages={
                  totalPages
                }
                paginationItems={
                  paginationItems
                }
                onChangePage={
                  changePage
                }
              />

            </>
          )
        }

      </main>

    </div>
  );

}
