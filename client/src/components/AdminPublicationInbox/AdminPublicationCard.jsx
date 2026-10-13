import styles from "../AdminPanel/AdminPanel.module.css";


export default function AdminPublicationCard({

  item,
  busy,

  onSelect,
  reviewPublication

}) {

  return (

    <div
      className={
        styles.publicationCard
      }
    >

      <div
        className={
          styles.publicationCardMain
        }
      >

        <div
          className={
            styles.publicationMeta
          }
        >
          {
            item.generatedAt
              ? new Date(
                  item.generatedAt
                )
                .toLocaleString(
                  "ru-RU"
                )
              : "Дата не указана"
          }
        </div>

        <h3
          className={
            styles.publicationProfession
          }
        >
          {
            item.profession
          }
        </h3>

        <div
          className={
            styles.publicationOrderId
          }
        >
          {
            item.id
          }
        </div>

      </div>


      <div
        className={
          styles.publicationActions
        }
      >

        <button
          type="button"
          className={
            styles.publicationSecondaryButton
          }
          onClick={
            () => {

              onSelect({
                orderId:
                  item.id,

                instruction:
                  item.instruction
              });

            }
          }
        >
          Просмотреть
        </button>


        <button
          type="button"
          className={
            styles.publicationApproveButton
          }
          disabled={
            busy
          }
          onClick={
            () =>
              reviewPublication(
                item.id,
                "approve"
              )
          }
        >
          Опубликовать
        </button>


        <button
          type="button"
          className={
            styles.publicationRejectButton
          }
          disabled={
            busy
          }
          onClick={
            () =>
              reviewPublication(
                item.id,
                "reject"
              )
          }
        >
          Отклонить
        </button>

      </div>

    </div>

  );

}
