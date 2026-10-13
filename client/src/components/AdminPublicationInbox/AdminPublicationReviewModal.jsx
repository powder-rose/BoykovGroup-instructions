import PrivateInstructionView from "../PrivateInstructionView/PrivateInstructionView.jsx";
import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminPublicationReviewModal({

  selectedPublicationInstruction,
  onClose

}) {

  if (
    !selectedPublicationInstruction
  ) {

    return null;

  }


  return (

    <div
      className={
        styles.publicationModalOverlay
      }
      onMouseDown={
        event => {

          if (
            event.target ===
              event.currentTarget
          ) {

            onClose();

          }

        }
      }
    >

      <div
        className={
          styles.publicationModal
        }
      >

        <div
          className={
            styles.publicationModalHeader
          }
        >

          <strong>
            Просмотр инструкции
          </strong>

          <button
            type="button"
            className={
              styles.publicationModalClose
            }
            onClick={
              onClose
            }
            aria-label="Закрыть"
          >
            ×
          </button>

        </div>


        <div
          className={
            styles.publicationModalContent
          }
        >

          <PrivateInstructionView
            compact
            instruction={
              selectedPublicationInstruction
                .instruction
            }
          />

        </div>

      </div>

    </div>

  );

}
