import {
  useState
} from "react";

import Header
  from "../../components/Header/Header.jsx";

import AdminPanel
  from "../../components/AdminPanel/AdminPanel.jsx";

import EditInstructionModal
  from "../../components/EditInstructionModal/EditInstructionModal.jsx";

import HomeCompactHeader
  from "./components/HomeCompactHeader/HomeCompactHeader.jsx";

import HomeIntro
  from "./components/HomeIntro/HomeIntro.jsx";

import InstructionResults
  from "./components/InstructionResults/InstructionResults.jsx";

import useHomeCompactHeader
  from "./hooks/useHomeCompactHeader.js";

import useHomeInstructions
  from "./hooks/useHomeInstructions.js";

import useInfiniteInstructions
  from "./hooks/useInfiniteInstructions.js";

import useInstructionEditor
  from "./hooks/useInstructionEditor.js";

import styles
  from "../../App.module.css";


export default function HomePage() {

  const [
    importId,
    setImportId
  ] =
    useState(null);


  const {
    isCompactHeader,
    stickyIntroRef,
    stickyTriggerRef
  } =
    useHomeCompactHeader();


  const {
    queryInput,
    setQueryInput,
    debouncedQuery,

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
    refresh
  } =
    useHomeInstructions();


  const {
    hasMore,
    loadMore,
    loadMoreRef
  } =
    useInfiniteInstructions({
      query:
        debouncedQuery,

      page:
        resultPage,

      totalPages,

      isSearching,
      isLoadingMore,
      loadMoreError
    });


  const {
    editingInstruction,
    openInstructionEditor,
    closeInstructionEditor,
    saveInstruction
  } =
    useInstructionEditor({
      query:
        debouncedQuery,

      isAdmin
    });


  return (
    <div
      className={
        styles.page
      }
    >

      <Header
        query={
          queryInput
        }
        onQueryChange={
          setQueryInput
        }
      />


      <AdminPanel
        importId={
          importId
        }
        onImportCreated={
          setImportId
        }
        onRefresh={
          refresh
        }
      />


      <HomeCompactHeader
        visible={
          isCompactHeader
        }
        query={
          queryInput
        }
        onQueryChange={
          setQueryInput
        }
      />


      <div
        ref={
          stickyTriggerRef
        }
        className={
          styles.stickyTrigger
        }
        aria-hidden="true"
      />


      <HomeIntro
        query={
          queryInput
        }
        onQueryChange={
          setQueryInput
        }
        containerRef={
          stickyIntroRef
        }
      />


      <InstructionResults
        items={
          items
        }
        total={
          total
        }
        query={
          debouncedQuery
        }
        isAdmin={
          isAdmin
        }
        isSearching={
          isSearching
        }
        searchError={
          searchError
        }
        isLoadingMore={
          isLoadingMore
        }
        loadMoreError={
          loadMoreError
        }
        hasMore={
          hasMore
        }
        deletingId={
          deletingId
        }
        loadMoreRef={
          loadMoreRef
        }
        onLoadMore={
          loadMore
        }
        onDelete={
          remove
        }
        onEdit={
          openInstructionEditor
        }
        showEmptyState={
          showEmptyState
        }
        isGenerating={
          isGenerating
        }
        generateError={
          generateError
        }
        onGenerate={
          generate
        }
      />


      {
        editingInstruction &&
        (
          <EditInstructionModal
            instruction={
              editingInstruction
            }
            onClose={
              closeInstructionEditor
            }
            onSave={
              saveInstruction
            }
          />
        )
      }

    </div>
  );

}
