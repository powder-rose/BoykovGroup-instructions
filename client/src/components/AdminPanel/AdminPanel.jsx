import {
  useSelector
} from "react-redux";

import {
  selectAuthToken,
  selectIsAdmin
} from "../../store/authSlice.js";

import AdminVisitorStats from "../AdminVisitorStats/AdminVisitorStats.jsx";
import AdminInstructionTop10 from "../AdminInstructionTop10/AdminInstructionTop10.jsx";
import AdminPromoCodes from "../AdminPromoCodes/AdminPromoCodes.jsx";
import AdminDashboardTabs from "../AdminDashboardTabs/AdminDashboardTabs.jsx";
import AdminPublicationInbox from "../AdminPublicationInbox/AdminPublicationInbox.jsx";
import AdminGenerationStats from "../AdminGenerationStats/AdminGenerationStats.jsx";
import AdminPanelActions from "../AdminPanelActions/AdminPanelActions.jsx";
import AdminImportBlock from "../AdminImportBlock/AdminImportBlock.jsx";
import useAdminPublicationInbox from "./hooks/useAdminPublicationInbox.js";
import useAdminGenerationStats from "./hooks/useAdminGenerationStats.js";
import useAdminDashboardTab from "./hooks/useAdminDashboardTab.js";
import styles from "./AdminPanel.module.css";


export default function AdminPanel({

  importId,
  onImportCreated,
  onRefresh

}) {

  const isAdmin =
    useSelector(
      selectIsAdmin
    );

  const token =
    useSelector(
      selectAuthToken
    );



  const {
    adminDashboardTab,
    changeAdminDashboardTab
  } =
    useAdminDashboardTab();


  const {
    publicationInbox,
    publicationInboxLoading,
    publicationInboxError,
    publicationReviewBusy,

    selectedPublicationInstruction,
    setSelectedPublicationInstruction,

    reviewPublication
  } =
    useAdminPublicationInbox({
      isAdmin,
      token
    });


  const {
    stats,
    statsError
  } =
    useAdminGenerationStats({
      isAdmin,
      token
    });



  return (

    <section className={styles.panel}>

      <AdminPanelActions
        isAdmin={
          isAdmin
        }
        publicationCount={
          publicationInbox.length
        }
        onImportCreated={
          onImportCreated
        }
      />

        {
          isAdmin &&
          (
            <AdminDashboardTabs
              activeTab={
                adminDashboardTab
              }
              onChange={
                changeAdminDashboardTab
              }
            />
          )
        }


      {
        isAdmin &&
        (
          <AdminPublicationInbox
            adminDashboardTab={
              adminDashboardTab
            }
            publicationInbox={
              publicationInbox
            }
            publicationInboxLoading={
              publicationInboxLoading
            }
            publicationInboxError={
              publicationInboxError
            }
            publicationReviewBusy={
              publicationReviewBusy
            }
            selectedPublicationInstruction={
              selectedPublicationInstruction
            }
            setSelectedPublicationInstruction={
              setSelectedPublicationInstruction
            }
            reviewPublication={
              reviewPublication
            }
          />
        )
      }




      {
        isAdmin &&
        token &&
        (
          <>

            <AdminVisitorStats
              token={
                token
              }
              hidden={
                adminDashboardTab !==
                  "visitors"
              }
            />


            <AdminInstructionTop10
              token={
                token
              }
              hidden={
                adminDashboardTab !==
                  "top10"
              }
            />

          </>
        )
      }


      {
        isAdmin &&
        (
          <AdminGenerationStats
            stats={
              stats
            }
            statsError={
              statsError
            }
          />
        )
      }


      {
        importId &&
        (
          <AdminImportBlock
            importId={
              importId
            }
            onImportCreated={
              onImportCreated
            }
            onRefresh={
              onRefresh
            }
          />
        )
      }


      {
        isAdmin &&
        token &&
        (
          <AdminPromoCodes
            token={
              token
            }
            hidden={
              adminDashboardTab !==
                "promocodes"
            }
          />
        )
      }

    </section>

  );
}
