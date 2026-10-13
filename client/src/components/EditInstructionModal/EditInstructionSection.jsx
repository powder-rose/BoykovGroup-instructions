import styles
  from "./EditInstructionModal.module.css";


export default function EditInstructionSection({

  section,
  sectionIndex,
  onRemove,
  onHeadingChange,
  onTextChange

}) {

  function handleRemove() {

    if (
      !String(
        section.__editorText ??
        ""
      )
        .trim() ||
      window.confirm(
        `Удалить раздел ${section.number}?`
      )
    ) {

      onRemove(
        sectionIndex
      );

    }

  }


  return (
    <div
      className={[
        styles.editorSection,
        styles.editorUnifiedSection
      ]
        .filter(Boolean)
        .join(" ")}
    >

      <div
        className={
          styles.editorSectionHeader
        }
      >

        <h3>
          Раздел{" "}
          {section.number}
        </h3>


        <button
          type="button"
          className={
            styles.editorDangerButton
          }
          onClick={
            handleRemove
          }
        >
          Удалить раздел
        </button>

      </div>


      <label
        className={
          styles.editorField
        }
      >
        Заголовок раздела

        <input
          value={
            section.heading ??
            ""
          }
          placeholder={
            `Название раздела ${section.number}`
          }
          onChange={
            event =>
              onHeadingChange(
                sectionIndex,
                event.target.value
              )
          }
        />
      </label>


      <label
        className={
          styles.editorUnifiedSectionField
        }
      >

        <span
          className={
            styles.editorUnifiedSectionLabel
          }
        >
          Содержание раздела
        </span>


        <textarea
          className={
            styles.editorUnifiedSectionTextarea
          }
          value={
            section.__editorText ??
            ""
          }
          onChange={
            event =>
              onTextChange(
                sectionIndex,
                event.target.value
              )
          }
          placeholder="Введите содержание всего раздела"
        />


        <span
          className={
            styles.editorUnifiedSectionHint
          }
        >
          Весь раздел редактируется здесь целиком. Новый абзац отделяйте пустой строкой.
        </span>

      </label>

    </div>
  );

}
