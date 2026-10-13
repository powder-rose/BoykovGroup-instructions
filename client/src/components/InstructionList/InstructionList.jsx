import InstructionButton
  from "../InstructionButton/InstructionButton.jsx";

import InstructionGenerationCard
  from "./InstructionGenerationCard.jsx";

import InstructionListPagination
  from "./InstructionListPagination.jsx";

import RevealItem
  from "./InstructionListRevealItem.jsx";

import useInstructionListPagination
  from "./hooks/useInstructionListPagination.js";

import styles
  from "./InstructionList.module.css";


export default function InstructionList({
  instructions,
  total = 0,
  query = "",
  isAdmin,
  onDelete,
  deletingId,
  onEdit
}) {

  const {
    currentPage,
    visibleItems,
    isPageLoading,
    paginationError,
    totalPages,
    paginationItems,
    changePage
  } =
    useInstructionListPagination({
      instructions,
      total,
      query
    });


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


        <InstructionGenerationCard
          delay={
            (
              visibleItems.length %
              3
            )
            *
            90
          }
        />

      </ul>


      <InstructionListPagination
        currentPage={
          currentPage
        }
        totalPages={
          totalPages
        }
        paginationItems={
          paginationItems
        }
        isPageLoading={
          isPageLoading
        }
        paginationError={
          paginationError
        }
        onChangePage={
          changePage
        }
      />


    </>
  );

}
