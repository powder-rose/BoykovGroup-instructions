import AddInstructionButton from "../AddInstructionButton/AddInstructionButton.jsx";
import GenerateInstructionButton from "../GenerateInstructionButton/GenerateInstructionButton.jsx";
import AutoGenerationToggle from "../AutoGenerationToggle/AutoGenerationToggle.jsx";
import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminPanelActions({

  isAdmin,
  publicationCount,
  onImportCreated

}) {

  return (

    <div className={styles.actions}>

      <AddInstructionButton
        onImportCreated={
          onImportCreated
        }
      />

      <GenerateInstructionButton />

      <AutoGenerationToggle />


      {
        isAdmin &&
        (
          <div
            className={
              styles.publicationBadge
            }
            title="Инструкции, ожидающие решения о публикации"
          >

            <span
              className={
                styles.publicationBadgeLabel
              }
            >
              На публикацию
            </span>

            <strong
              className={
                styles.publicationBadgeCount
              }
            >
              {
                publicationCount
              }
            </strong>

          </div>
        )
      }

    </div>

  );

}
