import AdminPublicationCard from "./AdminPublicationCard.jsx";
import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminPublicationList({

  publicationInbox,
  publicationInboxLoading,
  publicationReviewBusy,

  onSelect,
  reviewPublication

}) {

  if (
    publicationInboxLoading &&
    publicationInbox.length === 0
  ) {

    return (

      <div
        className={
          styles.publicationEmpty
        }
      >
        Загружаем новые инструкции...
      </div>

    );

  }


  if (
    publicationInbox.length === 0
  ) {

    return (

      <div
        className={
          styles.publicationEmpty
        }
      >
        Новых инструкций
        на публикацию нет.
      </div>

    );

  }


  return (

    <div
      className={
        styles.publicationList
      }
    >

      {
        publicationInbox.map(
          item => (

            <AdminPublicationCard
              key={
                item.id
              }
              item={
                item
              }
              busy={
                publicationReviewBusy ===
                  item.id
              }
              onSelect={
                onSelect
              }
              reviewPublication={
                reviewPublication
              }
            />

          )
        )
      }

    </div>

  );

}
