import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import InstructionPage from "./components/InstructionPage/InstructionPage.jsx";
import UrgentGenerationPage from "./components/UrgentGenerationPage/UrgentGenerationPage.jsx";
import Header from "./components/Header/Header.jsx";
import InstructionsCatalog from "./components/InstructionCatalog/InstructionsCatalog.jsx";
import InstructionList from "./components/InstructionList/InstructionList.jsx";
import InstructionSort from "./components/InstructionSort/InstructionSort.jsx";
import Loader from "./components/Loader/Loader.jsx";
import EmptyState from "./components/EmptyState/EmptyState.jsx";
import HeroPortrait from "./components/HeroPortrait/HeroPortrait.jsx";
import SearchBar from "./components/SearchBar/SearchBar.jsx";
import SiteLinkButton from "./components/SiteLinkButton/SiteLinkButton.jsx";
import { useDebouncedValue } from "./hooks/useDebouncedValue.js";
import {
  searchInstructions,
  generateInstruction,
  deleteInstruction,
} from "./store/instructionsSlice.js";
import Navigation from "./components/Navigation/Navigation.jsx";
import {
  restoreSession,
  selectAuthToken,
  selectIsAdmin
} from "./store/authSlice.js";
import { PAGE_SIZE } from "./constants.js";
import styles from "./App.module.css";
import EditInstructionModal from "./components/EditInstructionModal/EditInstructionModal.jsx";
import {
  updateInstruction
} from "./api/instructionsApi.js";

import {
  Routes,
  Route,
  useLocation
} from "react-router-dom";
import AdminPanel from "./components/AdminPanel/AdminPanel.jsx";
import SiteFooter from "./components/SiteFooter/SiteFooter.jsx";
import CookieConsent from "./components/CookieConsent/CookieConsent.jsx";
import VisitorTracker from "./components/VisitorTracker/VisitorTracker.jsx";



export default function App() {
  const dispatch = useDispatch();

  const location =
    useLocation();
  const isAdmin =
    useSelector(
      selectIsAdmin
    );

  const authToken =
    useSelector(
      selectAuthToken
    );

  const [importId,setImportId] = useState(null);
  const [queryInput, setQueryInput] = useState(
    () =>
      new URLSearchParams(
        window.location.search
      ).get("q") ?? ""
  );
  const [editingInstruction, setEditingInstruction] = useState(null);

  const [
    isCompactHeader,
    setIsCompactHeader
  ] = useState(false);
  const debouncedQuery = useDebouncedValue(queryInput, 350);

  const stickyIntroRef =
    useRef(null);

  const stickyTriggerRef =
    useRef(null);

  const loadMoreRef =
    useRef(null);

  const loadMoreLockRef =
    useRef(false);

  /*
   * После одной автоматической загрузки
   * ждём, пока sentinel выйдет из viewport.
   *
   * Это предотвращает:
   * page 2 -> page 3 -> page 4 -> ...
   * без прокрутки пользователя.
   */
  const loadMoreArmedRef =
    useRef(true);
  const {
    items,
    total,
    page: resultPage,
    totalPages,
    isSearching,
    isLoadingMore,
    searchError,
    loadMoreError,
    isGenerating,
    generateError,
    deletingId,
  } = useSelector((state) => state.instructions);

  //    (    localStorage)    .
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  /*
   * ==========================================================
   * ROUTE SCROLL RESET
   * ==========================================================
   *
   * React Router сам не обязан возвращать
   * новый route к началу страницы.
   *
   * Сбрасываем позицию ДО отрисовки кадра,
   * чтобы пользователь не увидел старое
   * compact-состояние sticky-header.
   */
  useLayoutEffect(() => {

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });

    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;

  }, [
    location.pathname
  ]);


  //         .
  /*
   * ==========================================================
   * BOYKOVDOCS INITIAL SEARCH
   * ==========================================================
   *
   * Первый запрос и каждый новый поисковый запрос
   * всегда начинаются с первой страницы.
   */
  useEffect(() => {

    loadMoreLockRef.current =
      false;

    loadMoreArmedRef.current =
      true;


    dispatch(
      searchInstructions({
        query:
          debouncedQuery,

        page:
          1,

        pageSize:
          PAGE_SIZE,

        append:
          false
      })
    );

  }, [
    dispatch,
    debouncedQuery
  ]);


  /*
   * ==========================================================
   * MAIN ROUTE STICKY RESET
   * ==========================================================
   *
   * При любом route-переходе compact-состояние
   * сбрасывается до первого кадра.
   */
  useLayoutEffect(() => {

    setIsCompactHeader(
      false
    );


    if (
      location.pathname === "/"
    ) {

      loadMoreLockRef.current =
        false;

      loadMoreArmedRef.current =
        true;

    }

  }, [
    location.pathname
  ]);


  useEffect(() => {

    /*
     * SAFE_FIXED_COMPACT_HEADER_V2
     *
     * Обычный hero никогда не меняет свою высоту.
     * Compact header является отдельным fixed-слоем.
     */
    if (
      location.pathname !== "/"
    ) {
      setIsCompactHeader(false);
      return undefined;
    }

    const intro =
      stickyIntroRef.current;

    if (!intro) {
      setIsCompactHeader(false);
      return undefined;
    }

    let frameId =
      null;

    const update =
      () => {

        frameId =
          null;

        const top =
          intro
            .getBoundingClientRect()
            .top;

        setIsCompactHeader(
          (current) => {

            if (current) {

              if (
                top >= 16
              ) {
                return false;
              }

              return true;
            }

            if (
              top <= -4
            ) {
              return true;
            }

            return false;
          }
        );
      };

    const scheduleUpdate =
      () => {

        if (
          frameId !== null
        ) {
          return;
        }

        frameId =
          window.requestAnimationFrame(
            update
          );
      };

    update();

    window.addEventListener(
      "scroll",
      scheduleUpdate,
      {
        passive: true
      }
    );

    window.addEventListener(
      "resize",
      scheduleUpdate
    );

    return () => {

      window.removeEventListener(
        "scroll",
        scheduleUpdate
      );

      window.removeEventListener(
        "resize",
        scheduleUpdate
      );

      if (
        frameId !== null
      ) {
        window.cancelAnimationFrame(
          frameId
        );
      }
    };

  }, [
    location.pathname
  ]);


  const hasMore =
    resultPage <
    totalPages;


  useEffect(() => {

    loadMoreArmedRef.current =
      true;

  }, [
    debouncedQuery
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
              query:
                debouncedQuery,

              page:
                resultPage + 1,

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
        debouncedQuery,
        resultPage,
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

          /*
           * Новые карточки вытолкнули sentinel
           * за пределы viewport.
           *
           * Теперь пользователь может прокрутить
           * до него ещё раз и получить следующую страницу.
           */
          if (
            !entry.isIntersecting
          ) {
            loadMoreArmedRef.current =
              true;

            return;
          }


          if (
            entry.isIntersecting
          ) {
            void loadMore();
          }

        },
        {
          /*
           * Следующая порция начинает
           * загружаться заранее.
           */
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


  async function handleGenerate() {
    if (!isAdmin) return;
    await dispatch(generateInstruction(debouncedQuery));
  }

  async function handleEditOpen(instruction) {

  const response = await fetch(
    `/api/instructions/${instruction.id}`
  );


  if (!response.ok) {
    return;
  }


  const fullInstruction = await response.json();


  setEditingInstruction(fullInstruction);

}

  function handleDelete(id) {
    if (!isAdmin) return;
    dispatch(deleteInstruction(id));
  }

  async function handleEditSave(updated) {

    if (
      !isAdmin ||
      !authToken
    ) {
      return;
    }


    try {

      await updateInstruction(
        updated.id,
        updated,
        authToken
      );


      setEditingInstruction(
        null
      );


      dispatch(
        searchInstructions({
          query:
            debouncedQuery,

          page:
            1,

          pageSize:
            PAGE_SIZE
        })
      );

    }
    catch(error) {

      console.error(
        "Instruction save error:",
        error
      );

    }

  }

  const showEmptyState = !isSearching && !searchError && debouncedQuery.trim() && items.length === 0;

  function handleImportRefresh(){

    dispatch(
        searchInstructions({
            query: debouncedQuery,
            page: 1,
            pageSize: PAGE_SIZE
        })
    );

}

 return (
  <>

    <VisitorTracker />


  <Routes>

    <Route
      path="/"
      element={
        <div className={styles.page}>

         <Header
  query={queryInput}
  onQueryChange={setQueryInput}
/>


<AdminPanel

    importId={importId}

    onImportCreated={(id)=>{

        setImportId(id);

    }}

    onRefresh={handleImportRefresh}

/>


{/* SAFE_FIXED_COMPACT_HEADER_V3 */}
            <div
              className={[
                styles.safeCompactHeader,
                isCompactHeader
                  ? styles.safeCompactHeaderVisible
                  : ""
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden={!isCompactHeader}
            >
              <div className={styles.safeCompactInner}>

                <div className={styles.stickyIntroCompact}>

                  <div
                    className={
                      styles.compactControls
                    }
                  >

                    <div
                      className={
                        styles.compactSearch
                      }
                    >
                      <SearchBar
                        value={queryInput}
                        onChange={setQueryInput}
                      />
                    </div>

                    <div
                      className={
                        styles.compactLogo
                      }
                    >
                      <SiteLinkButton />
                    </div>

                  </div>

                  <Navigation />

                  <section
                    className={
                      styles.hero
                    }
                  >

                    <div
                      className={
                        styles.heroText
                      }
                    >

                      <h1
                        className={
                          styles.title
                        }
                      >
                        Инструкции по охране труда
                      </h1>

                      <p
                        className={
                          styles.subtitle
                        }
                      >
                        Найдите готовую инструкцию для нужной профессии.
                        База пополняется автоматически каждый день.
                      </p>

                    </div>

                    <div
                      className={
                        styles.heroPortraitWrap
                      }
                    >
                      <HeroPortrait
                        compact={true}
                      />
                    </div>

                  </section>

                </div>

              </div>
            </div>

            <div
            ref={stickyTriggerRef}
            className={styles.stickyTrigger}
            aria-hidden="true"
          />

          <div ref={stickyIntroRef}
              className={styles.stickyIntro}>

            {/* COMPACT STICKY HEADER */}
            <div
              className={
                styles.compactControls
              }
            >

              <div
                className={
                  styles.compactSearch
                }
              >
                <SearchBar
                  value={queryInput}
                  onChange={setQueryInput}
                />
              </div>


              <div
                className={
                  styles.compactLogo
                }
              >
                <SiteLinkButton />
              </div>

            </div>

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

            <div
                className={
                  styles.heroPortraitWrap
                }
              >
                <HeroPortrait compact={false} />
              </div>

          </section>
          </div>

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


<InstructionSort />


<InstructionList
  instructions={items}
  total={total}
  query={debouncedQuery}
  isAdmin={isAdmin}
  onDelete={handleDelete}
  onEdit={handleEditOpen}
  deletingId={deletingId}
/>


                <div
                  ref={loadMoreRef}
                  className={styles.loadMoreZone}
                  aria-live="polite"
                >

                  {isLoadingMore && (
                    <span
                      className={
                        styles.loadMoreText
                      }
                    >
                      [ загружаем ещё ]
                    </span>
                  )}


                  {!isLoadingMore &&
                    loadMoreError &&
                    hasMore && (

                      <button
                        type="button"
                        className={
                          styles.loadMoreRetry
                        }
                        onClick={loadMore}
                      >
                        [ повторить загрузку ]
                      </button>

                    )}


                  {!isLoadingMore &&
                    !loadMoreError &&
                    !hasMore && (

                      <span
                        className={
                          styles.loadMoreDone
                        }
                      >
                        [ все инструкции загружены ]
                      </span>

                    )}

                </div>

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

          {editingInstruction && (

  <EditInstructionModal

    instruction={editingInstruction}

    onClose={() => setEditingInstruction(null)}

    onSave={handleEditSave}

  />

)}
        </div>
      }
    />
<Route
  path="/instrukcii-po-ohrane-truda"
  element={<InstructionsCatalog />}
/>

    <Route
      path="/srochnaya-generaciya-instrukcii"
      element={<UrgentGenerationPage />}
    />

    <Route
      path="/instrukciya-po-ohrane-truda/:id"
      element={<InstructionPage />}
    />


  </Routes>


    <SiteFooter />


    <CookieConsent />


  </>
);
}
