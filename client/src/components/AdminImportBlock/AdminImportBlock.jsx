import ImportManager from "../ImportManager/ImportManager.jsx";
import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminImportBlock({

  importId,
  onImportCreated,
  onRefresh

}) {

  return (

    <div className={styles.importBlock}>

      <ImportManager
        importId={
          importId
        }
        onComplete={
          () => {
            onImportCreated(
              null
            );
          }
        }
        onRefresh={
          onRefresh
        }
      />

    </div>

  );

}
