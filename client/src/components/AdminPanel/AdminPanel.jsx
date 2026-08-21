import ImportManager from "../ImportManager/ImportManager.jsx";
import AddInstructionButton from "../AddInstructionButton/AddInstructionButton.jsx";
import GenerateInstructionButton from "../GenerateInstructionButton/GenerateInstructionButton.jsx";

import styles from "./AdminPanel.module.css";


export default function AdminPanel({

    importId,
    onImportCreated,
    onRefresh

}) {


    return (

        <section className={styles.panel}>


            <div className={styles.actions}>


                <AddInstructionButton

                    onImportCreated={onImportCreated}

                />


                <GenerateInstructionButton />


            </div>



            {
                importId && (

                    <div className={styles.importBlock}>


                      <ImportManager

    importId={importId}

    onComplete={()=>{
        onImportCreated(null);
    }}

    onRefresh={onRefresh}

/>




                    </div>

                )
            }


        </section>

    );

}