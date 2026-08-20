import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Header from "./components/Header/Header.jsx";
import CategoryNav from "./components/CategoryNav/CategoryNav.jsx";
import InstructionList from "./components/InstructionList/InstructionList.jsx";
import Pagination from "./components/Pagination/Pagination.jsx";
import Loader from "./components/Loader/Loader.jsx";
import EmptyState from "./components/EmptyState/EmptyState.jsx";
import InstructionModal from "./components/InstructionModal/InstructionModal.jsx";
import { useDebouncedValue } from "./hooks/useDebouncedValue.js";
import {
  searchInstructions,
  fetchInstruction,
  clearSelectedInstruction,
  generateInstruction,
  deleteInstruction,
} from "./store/instructionsSlice.js";
import { restoreSession, selectIsAdmin } from "./store/authSlice.js";
import { PAGE_SIZE } from "./constants.js";
import styles from "./App.module.css";

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

  // Восстанавливаем сессию админа (если токен сохранён в localStorage) один раз при загрузке.
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  // Сбрасываем страницу на первую при каждом новом поисковом запросе.
  useEffect(() => {
    setRequestedPage(1);
  }, [debouncedQuery]);

  // Поиск инструкций на сервере при изменении запроса или страницы.
  useEffect(() => {
    dispatch(searchInstructions({ query: debouncedQuery, page: requestedPage, pageSize: PAGE_SIZE }));
  }, [dispatch, debouncedQuery, requestedPage]);

  function handleSelect(id) {
    dispatch(fetchInstruction(id));
  }

  function handleCloseModal() {
    dispatch(clearSelectedInstruction());
  }

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
    <div className={styles.page}>
      <Header query={queryInput} onQueryChange={setQueryInput} />
      <CategoryNav />

      <section className={styles.hero}>
        <h1 className={styles.title}>Инструкции по охране труда</h1>
        <p className={styles.subtitle}>
          {isAdmin
            ? "Вы вошли как администратор — можно генерировать новые инструкции через YandexGPT и удалять существующие."
            : "Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день."}
        </p>
      </section>

      <main>
        {isSearching && <Loader label="Ищем инструкции..." />}

        {!isSearching && searchError && (
          <p className={styles.error}>Не удалось выполнить поиск: {searchError}</p>
        )}

        {!isSearching && !searchError && items.length > 0 && (
          <>
            <div className={styles.resultsHead}>
              <span className={styles.count}>[ найдено: {total} ]</span>
            </div>
            <InstructionList
              instructions={items}
              onSelect={handleSelect}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
            <Pagination page={resultPage} totalPages={totalPages} onChange={setRequestedPage} />
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

      {(selected || isLoadingSelected || selectedError) && (
        <InstructionModal
          instruction={selected}
          isLoading={isLoadingSelected}
          error={selectedError}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}