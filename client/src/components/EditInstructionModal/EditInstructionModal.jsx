import {
  useEffect,
  useState
} from "react";

import {
  useSelector
} from "react-redux";

import {
  selectAuthToken
} from "../../store/authSlice.js";

import {
  getInstructionHistory,
  rollbackInstruction
} from "../../api/instructionsApi.js";

import styles from "./EditInstructionModal.module.css";


function prepareInstruction(
  instruction
) {

  return {
    ...instruction,

    sections:
      (
        Array.isArray(
          instruction?.sections
        )
          ? instruction.sections
          : []
      )
        .map(
          section => ({
            ...section,

            paragraphs:
              Array.isArray(
                section.paragraphs
              )
                ? [
                    ...section.paragraphs
                  ]
                : [],

            __editorText:
              (
                Array.isArray(
                  section.paragraphs
                )
                  ? section.paragraphs
                  : []
              )
                .join(
                  "\n\n"
                )
          })
        )
  };

}


export default function EditInstructionModal({
  instruction,
  onClose,
  onSave
}) {

  const [
    data,
    setData
  ] =
    useState(
      () =>
        prepareInstruction(
          instruction
        )
    );


  const token =
    useSelector(
      selectAuthToken
    );


  const [
    history,
    setHistory
  ] =
    useState(null);


  const [
    rollbackBusy,
    setRollbackBusy
  ] =
    useState(false);


  const [
    saveBusy,
    setSaveBusy
  ] =
    useState(false);


  /*
   * Production блокирует scroll страницы,
   * пока открыт полноценный editor.
   */
  useEffect(() => {

    const previousOverflow =
      document.body.style
        .overflow;


    document.body.style
      .overflow =
      "hidden";


    return () => {

      document.body.style
        .overflow =
        previousOverflow;

    };

  }, []);


  /*
   * История версий для rollback.
   */
  useEffect(() => {

    if (
      !instruction?.id ||
      !token
    ) {

      setHistory(
        null
      );

      return undefined;

    }


    let cancelled =
      false;


    getInstructionHistory(
      instruction.id,
      token
    )
      .then(
        result => {

          if (!cancelled) {

            setHistory(
              result
            );

          }

        }
      )
      .catch(
        () => {

          if (!cancelled) {

            setHistory(
              null
            );

          }

        }
      );


    return () => {

      cancelled =
        true;

    };

  }, [
    instruction?.id,
    token
  ]);


  /*
   * Общее поле инструкции.
   */
  function updateField(
    field,
    value
  ) {

    setData(
      current => ({
        ...current,
        [field]:
          value
      })
    );

  }


  /*
   * Заголовок раздела.
   */
  function updateSectionHeading(
    sectionIndex,
    value
  ) {

    setData(
      current => ({
        ...current,

        sections:
          (
            current.sections ||
            []
          )
            .map(
              (
                section,
                index
              ) =>
                index ===
                  sectionIndex
                  ? {
                      ...section,

                      heading:
                        value
                    }
                  : section
            )
      })
    );

  }


  /*
   * Единый текст раздела.
   */
  function updateSectionText(
    sectionIndex,
    value
  ) {

    setData(
      current => ({
        ...current,

        sections:
          (
            current.sections ||
            []
          )
            .map(
              (
                section,
                index
              ) =>
                index ===
                  sectionIndex
                  ? {
                      ...section,

                      __editorText:
                        value
                    }
                  : section
            )
      })
    );

  }


  /*
   * Удалить раздел.
   */
  function removeSection(
    sectionIndex
  ) {

    setData(
      current => ({
        ...current,

        sections:
          (
            current.sections ||
            []
          )
            .filter(
              (
                _section,
                index
              ) =>
                index !==
                sectionIndex
            )
            .map(
              (
                section,
                index
              ) => ({
                ...section,

                number:
                  index + 1
              })
            )
      })
    );

  }


  /*
   * Добавить раздел.
   */
  function addSection() {

    setData(
      current => {

        const sections =
          Array.isArray(
            current.sections
          )
            ? current.sections
            : [];


        return {
          ...current,

          sections: [
            ...sections,

            {
              number:
                sections.length +
                1,

              heading:
                "",

              paragraphs:
                [],

              __editorText:
                ""
            }
          ]
        };

      }
    );

  }


  /*
   * Сохранение.
   *
   * Production хранит в UI единый текст,
   * а перед API снова превращает его
   * в массив paragraphs.
   *
   * Пустая строка = новый абзац.
   */
  async function handleSave() {

    if (
      saveBusy
    ) {
      return;
    }


    setSaveBusy(
      true
    );


    try {

      const payload = {
        ...data,

        sections:
          (
            data.sections ||
            []
          )
            .map(
              ({
                __editorText,
                ...section
              }) => ({
                ...section,

                paragraphs:
                  String(
                    __editorText ??
                    ""
                  )
                    .replace(
                      /\r\n?/g,
                      "\n"
                    )
                    .split(
                      /\n\s*\n/u
                    )
                    .map(
                      paragraph =>
                        paragraph.trim()
                    )
                    .filter(
                      Boolean
                    )
              })
            )
      };


      await onSave(
        payload
      );

    }
    finally {

      setSaveBusy(
        false
      );

    }

  }


  async function handleRollback() {

    if (
      rollbackBusy ||
      !history?.available ||
      !instruction?.id ||
      !token
    ) {
      return;
    }


    if (
      !window.confirm(
        "Вернуть инструкцию к состоянию до последнего сохранения?"
      )
    ) {
      return;
    }


    setRollbackBusy(
      true
    );


    try {

      await rollbackInstruction(
        instruction.id,
        token
      );


      window.alert(
        "Предыдущая версия восстановлена."
      );


      window.location.reload();

    }
    catch(error) {

      console.error(
        "Rollback error:",
        error
      );


      window.alert(
        error?.message ||
        "Не удалось выполнить откат."
      );


      setRollbackBusy(
        false
      );

    }

  }


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

                <div
                  className={[
                    styles.editorSection,
                    styles.editorUnifiedSection
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={
                    `${section.number}-${sectionIndex}`
                  }
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
                        () => {

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

                            removeSection(
                              sectionIndex
                            );

                          }

                        }
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
                          updateSectionHeading(
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
                          updateSectionText(
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
