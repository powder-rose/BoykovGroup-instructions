import AdminPublicationList from "./AdminPublicationList.jsx";
import AdminPublicationReviewModal from "./AdminPublicationReviewModal.jsx";
import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminPublicationInbox({

  adminDashboardTab,

  publicationInbox,
  publicationInboxLoading,
  publicationInboxError,
  publicationReviewBusy,

  selectedPublicationInstruction,
  setSelectedPublicationInstruction,

  reviewPublication

}) {

  return (

    <div
      data-boykov-admin-tab-section="publications"
      className={[
        styles.publicationInbox,

        adminDashboardTab !==
          "publications"
          ? "boykovAdminDashboardSection--hidden"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >

      <div
        className={
          styles.publicationInboxHeader
        }
      >

        <div>

          <div
            className={
              styles.publicationInboxEyebrow
            }
          >
            Публикации
          </div>

          <h2
            className={
              styles.publicationInboxTitle
            }
          >
            Ящик инструкций
          </h2>

          <p
            className={
              styles.publicationInboxDescription
            }
          >
            Оплаченные инструкции уже
            выданы пользователям.
            Здесь вы решаете только,
            публиковать ли их
            в общем каталоге.
          </p>

        </div>


        <div
          className={
            styles.publicationInboxCount
          }
        >
          {
            publicationInbox.length
          }
        </div>

      </div>


      {
        publicationInboxError &&
        (
          <div
            className={
              styles.statsError
            }
          >
            {
              publicationInboxError
            }
          </div>
        )
      }


      <AdminPublicationList
        publicationInbox={
          publicationInbox
        }
        publicationInboxLoading={
          publicationInboxLoading
        }
        publicationReviewBusy={
          publicationReviewBusy
        }
        onSelect={
          setSelectedPublicationInstruction
        }
        reviewPublication={
          reviewPublication
        }
      />


      <AdminPublicationReviewModal
        selectedPublicationInstruction={
          selectedPublicationInstruction
        }
        onClose={
          () =>
            setSelectedPublicationInstruction(
              null
            )
        }
      />

    </div>

  );

}
