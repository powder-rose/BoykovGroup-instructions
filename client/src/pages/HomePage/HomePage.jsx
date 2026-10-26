import { lazy, Suspense, useState } from 'react';

import Header from '../../components/Header/Header.jsx';

import AdminPanel from '../../components/AdminPanel/AdminPanel.jsx';

import HomeCompactHeader from './components/HomeCompactHeader/HomeCompactHeader.jsx';

import HomeIntro from './components/HomeIntro/HomeIntro.jsx';

import InstructionResults from './components/InstructionResults/InstructionResults.jsx';
import CatalogTaxonomyFilters from '../../components/InstructionCatalog/CatalogTaxonomyFilters.jsx';
import useTaxonomyNavigation from '../../components/TaxonomyLandingPage/useTaxonomyNavigation.js';

import useHomeCompactHeader from './hooks/useHomeCompactHeader.js';

import useHomeInstructions from './hooks/useHomeInstructions.js';

import useInfiniteInstructions from './hooks/useInfiniteInstructions.js';

import useInstructionEditor from './hooks/useInstructionEditor.js';

import styles from '../../App.module.css';

const EditInstructionModal = lazy(
  () => import('../../components/EditInstructionModal/EditInstructionModal.jsx'),
);

export default function HomePage() {
  const [importId, setImportId] = useState(null);
  const { navigation } = useTaxonomyNavigation();

  const { isCompactHeader, stickyIntroRef, stickyTriggerRef } = useHomeCompactHeader();

  const {
    queryInput,
    setQueryInput,
    debouncedQuery,
    catalogId,
    category,
    tag,
    changeCatalog,
    changeCategory,
    changeTag,
    clearTaxonomy,
    filterOptions,
    filterError,
    filtersLoading,

    isAdmin,

    items,
    total,
    resultPage,
    totalPages,

    isSearching,
    isLoadingMore,
    searchError,
    loadMoreError,

    isGenerating,
    generateError,
    deletingId,

    showEmptyState,

    generate,
    remove,
    refresh,
  } = useHomeInstructions();

  const { hasMore, loadMore, loadMoreRef } = useInfiniteInstructions({
    query: debouncedQuery,
    catalogId,
    category,
    tag,

    page: resultPage,

    totalPages,

    isSearching,
    isLoadingMore,
    loadMoreError,
  });

  const { editingInstruction, openInstructionEditor, closeInstructionEditor, instructionSaved } =
    useInstructionEditor({
      query: debouncedQuery,
      catalogId,
      category,
      tag,

      isAdmin,
    });

  return (
    <div className={styles.page}>
      <Header query={queryInput} onQueryChange={setQueryInput} />

      <AdminPanel importId={importId} onImportCreated={setImportId} onRefresh={refresh} />

      <HomeCompactHeader
        visible={isCompactHeader}
        query={queryInput}
        onQueryChange={setQueryInput}
      />

      <div ref={stickyTriggerRef} className={styles.stickyTrigger} aria-hidden="true" />

      <HomeIntro query={queryInput} onQueryChange={setQueryInput} containerRef={stickyIntroRef} />

      <InstructionResults
        items={items}
        total={total}
        query={debouncedQuery}
        filtered={Boolean(debouncedQuery || catalogId || category || tag)}
        isAdmin={isAdmin}
        isSearching={isSearching}
        searchError={searchError}
        isLoadingMore={isLoadingMore}
        loadMoreError={loadMoreError}
        hasMore={hasMore}
        deletingId={deletingId}
        loadMoreRef={loadMoreRef}
        onLoadMore={loadMore}
        onDelete={remove}
        onEdit={openInstructionEditor}
        showEmptyState={showEmptyState}
        isGenerating={isGenerating}
        generateError={generateError}
        onGenerate={generate}
      >
        <CatalogTaxonomyFilters
          options={filterOptions}
          navigation={navigation}
          catalogId={catalogId}
          category={category}
          tag={tag}
          onCatalogChange={changeCatalog}
          onCategoryChange={changeCategory}
          onTagChange={changeTag}
          onReset={clearTaxonomy}
          error={filterError}
          loading={filtersLoading}
        />
      </InstructionResults>

      {editingInstruction && (
        <Suspense fallback={<p role="status">Загрузка редактора…</p>}>
          <EditInstructionModal
            instruction={editingInstruction}
            onClose={closeInstructionEditor}
            onSaved={instructionSaved}
          />
        </Suspense>
      )}
    </div>
  );
}
