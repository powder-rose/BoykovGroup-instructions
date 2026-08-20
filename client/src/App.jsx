import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import InstructionPage from "./components/InstructionPage/InstructionPage.jsx";
import Header from "./components/Header/Header.jsx";
import InstructionsCatalog from "./components/InstructionCatalog/InstructionsCatalog.jsx";
import InstructionList from "./components/InstructionList/InstructionList.jsx";
import Pagination from "./components/Pagination/Pagination.jsx";
import Loader from "./components/Loader/Loader.jsx";
import EmptyState from "./components/EmptyState/EmptyState.jsx";
import HeroPortrait from "./components/HeroPortrait/HeroPortrait.jsx";
import { useDebouncedValue } from "./hooks/useDebouncedValue.js";
import {
  searchInstructions,
  generateInstruction,
  deleteInstruction,
} from "./store/instructionsSlice.js";
import Navigation from "./components/Navigation/Navigation.jsx";
import { restoreSession, selectIsAdmin } from "./store/authSlice.js";
import { PAGE_SIZE } from "./constants.js";
import styles from "./App.module.css";

import {
  Routes,
  Route
} from "react-router-dom";



export default function App() {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);

  const [queryInput, setQueryInput] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const debouncedQuery = useDebouncedValue(queryInput, 350);

  const {
    items,
    total,
    page: resultPage,
    totalPages,
    isSearching,
    searchError,
    selected,
    isLoadingSelected,
    selectedError,
    isGenerating,
    generateError,
    deletingId,
  } = useSelector((state) => state.instructions);

  //    (    localStorage)    .
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  //         .
  useEffect(() => {
    setRequestedPage(1);
  }, [debouncedQuery]);

  //         .
  useEffect(() => {
    dispatch(searchInstructions({ query: debouncedQuery, page: requestedPage, pageSize: PAGE_SIZE }));
  }, [dispatch, debouncedQuery, requestedPage]);


  async function handleGenerate() {
    if (!isAdmin) return;
    await dispatch(generateInstruction(debouncedQuery));
  }

  function handleDelete(id) {
    if (!isAdmin) return;
    dispatch(deleteInstruction(id));
  }

  const showEmptyState = !isSearching && !searchError && debouncedQuery.trim() && items.length === 0;

 return (
  <Routes>

    <Route
      path="/"
      element={
        <div className={styles.page}>

          <Header
            query={queryInput}
            onQueryChange={setQueryInput}
          />

          <Navigation />


          <section className={styles.hero}>
            <div className={styles.heroText}>

              <h1 className={styles.title}>
                Инструкции по охране труда
              </h1>

              <p className={styles.subtitle}>
                Найдите готовую инструкцию для нужной профессии.
                База пополняется автоматически каждый день.
              </p>

            </div>

            <HeroPortrait />

          </section>


          <main>

            {isSearching && (
              <Loader label="Загрузка..." />
            )}


            {!isSearching && searchError && (
              <p className={styles.error}>
                Ошибка: {searchError}
              </p>
            )}


            {!isSearching && !searchError && items.length > 0 && (
              <>

                <div className={styles.resultsHead}>
                  <span className={styles.count}>
                    Всего инструкций: {total}
                  </span>
                </div>


                <InstructionList
  instructions={items}
  isAdmin={isAdmin}
  onDelete={handleDelete}
  deletingId={deletingId}
/>


                <Pagination
                  page={resultPage}
                  totalPages={totalPages}
                  onChange={setRequestedPage}
                />

              </>
            )}


            {showEmptyState && (
              <EmptyState
                query={debouncedQuery}
                isAdmin={isAdmin}
                isGenerating={isGenerating}
                error={generateError}
                onGenerate={handleGenerate}
              />
            )}

          </main>

        </div>
      }
    />
<Route
  path="/instrukcii-po-ohrane-truda"
  element={<InstructionsCatalog />}
/>

    <Route
      path="/instrukciya-po-ohrane-truda/:id"
      element={<InstructionPage />}
    />


  </Routes>
);
}
