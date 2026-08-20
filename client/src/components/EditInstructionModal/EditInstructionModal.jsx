import { useState } from "react";
import styles from "./EditInstructionModal.module.css";


export default function EditInstructionModal({
  instruction,
  onClose,
  onSave,
}) {

  const [data, setData] = useState({
    ...instruction,
    sections: (instruction.sections || []).map(section => ({
      ...section,
      paragraphs: [...section.paragraphs],
    })),
  });


  function updateField(field, value) {

    setData(prev => ({
      ...prev,
      [field]: value,
    }));

  }


  function updateParagraph(
    sectionIndex,
    paragraphIndex,
    value
  ) {

    setData(prev => {

      const sections = [...prev.sections];

      sections[sectionIndex].paragraphs[paragraphIndex] = value;


      return {
        ...prev,
        sections,
      };

    });

  }



  async function handleSave() {

    await onSave(data);

  }



  return (
    <div className={styles.overlay}>

      <div className={styles.modal}>


        <button
          className={styles.close}
          onClick={onClose}
        >
          ×
        </button>



        <h2>
          Редактирование инструкции
        </h2>



        <label>
          Название

          <input
            value={data.title}
            onChange={(e)=>
              updateField(
                "title",
                e.target.value
              )
            }
          />

        </label>



        <label>
          Вводный текст

          <textarea
            value={data.intro}
            onChange={(e)=>
              updateField(
                "intro",
                e.target.value
              )
            }
          />

        </label>



       {(data.sections || []).map(
          (section, sectionIndex)=>(

          <div
            className={styles.section}
            key={section.number}
          >

            <h3>
              Раздел {section.number}
            </h3>



            {section.paragraphs.map(
              (paragraph, paragraphIndex)=>(

              <textarea
                key={paragraphIndex}
                value={paragraph}
                onChange={(e)=>
                  updateParagraph(
                    sectionIndex,
                    paragraphIndex,
                    e.target.value
                  )
                }
              />

            ))}


          </div>

        ))}



        <button
          className={styles.save}
          onClick={handleSave}
        >
          Сохранить изменения
        </button>


      </div>

    </div>
  );
}