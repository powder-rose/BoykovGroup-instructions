import EditInstructionSection
  from "./EditInstructionSection.jsx";

import useEditInstructionModal
  from "./hooks/useEditInstructionModal.js";

import styles from "./EditInstructionModal.module.css";


export default function EditInstructionModal({
  instruction,
  onClose,
  onSave
}) {

  const {
    data,
    history,
    rollbackBusy,
    saveBusy,
    updateField,
    updateSectionHeading,
    updateSectionText,
    removeSection,
    addSection,
    handleSave,
    handleRollback
  } =
    useEditInstructionModal({
      instruction,
      onSave
    });


  return (
    <div
      className={
        styles.overlay
      }
    >

      <div
        className={[
          styles.modal,
          styles.editorFullModal
        ]
          .filter(Boolean)
          .join(" ")}
      >

        <button
          type="button"
          className={
            styles.close
          }
          onClick={
            onClose
          }
        >
          ×
        </button>


        <h2>
          Редактирование инструкции
        </h2>


        <label
          className={
            styles.editorField
          }
        >
          Название

          <input
            value={
              data.title ??
              ""
            }
            onChange={
              event =>
                updateField(
                  "title",
                  event.target.value
                )
            }
          />
        </label>


        <label
          className={
            styles.editorField
          }
        >
          Вводный текст

          <textarea
            value={
              data.intro ??
              ""
            }
            onChange={
              event =>
                updateField(
                  "intro",
                  event.target.value
                )
            }
          />
        </label>


        {
          (
            data.sections ||
            []
          )
            .map(
              (
                section,
                sectionIndex
              ) => (

                <EditInstructionSection
                  key={
                    `${section.number}-${sectionIndex}`
                  }
                  section={
                    section
                  }
                  sectionIndex={
                    sectionIndex
                  }
                  onRemove={
                    removeSection
                  }
                  onHeadingChange={
                    updateSectionHeading
                  }
                  onTextChange={
                    updateSectionText
                  }
                />

              )
            )
        }


        <button
          type="button"
          className={
            styles.editorAddSectionButton
          }
          onClick={
            addSection
          }
        >
          + Добавить раздел
        </button>


        <button
          type="button"
          className={
            styles.rollbackButton
          }
          disabled={
            rollbackBusy ||
            !history?.available
          }
          onClick={
            handleRollback
          }
        >
          {
            rollbackBusy
              ? "Откатываем..."
              : history?.available
                ? (
                    history.count >
                      1
                      ? `Откатить последнее сохранение · ${history.count} версий`
                      : "Откатить последнее сохранение"
                  )
                : "Нет предыдущей версии"
          }
        </button>


        <button
          type="button"
          className={
            styles.save
          }
          disabled={
            saveBusy
          }
          onClick={
            handleSave
          }
        >
          {
            saveBusy
              ? "Сохранение..."
              : "Сохранить изменения"
          }
        </button>

      </div>

    </div>
  );

}
