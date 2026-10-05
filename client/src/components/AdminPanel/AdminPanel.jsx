import {
  useEffect,
  useState
} from "react";

import {
  useSelector
} from "react-redux";

import ImportManager from "../ImportManager/ImportManager.jsx";
import AddInstructionButton from "../AddInstructionButton/AddInstructionButton.jsx";
import GenerateInstructionButton from "../GenerateInstructionButton/GenerateInstructionButton.jsx";
import AutoGenerationToggle from "../AutoGenerationToggle/AutoGenerationToggle.jsx";

import {
  selectAuthToken,
  selectIsAdmin
} from "../../store/authSlice.js";

import {
  getGenerationStats
} from "../../api/instructionsApi.js";

import PrivateInstructionView from "../PrivateInstructionView/PrivateInstructionView.jsx";
import AdminVisitorStats from "../AdminVisitorStats/AdminVisitorStats.jsx";
import AdminInstructionTop10 from "../AdminInstructionTop10/AdminInstructionTop10.jsx";
import AdminPromoCodes from "../AdminPromoCodes/AdminPromoCodes.jsx";
import AdminDashboardTabs from "../AdminDashboardTabs/AdminDashboardTabs.jsx";
import styles from "./AdminPanel.module.css";


const numberFormatter =
  new Intl.NumberFormat(
    "ru-RU"
  );

const rubFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );


function number(value) {

  return numberFormatter.format(
    Number(value) || 0
  );
}


function rub(value) {

  return (
    rubFormatter.format(
      Number(value) || 0
    ) +
    " ₽"
  );
}



function getGenerationTypeLabel(source) {
  switch (source) {
    case "schedule":
      return "По расписанию";

    case "repair":
      return "Восстановление";

    case "import":
      return "Импорт";

    case "generation":
    default:
      return "Генерация";
  }
}


const ADMIN_DASHBOARD_TAB_KEY =
  "boykov_admin_dashboard_tab_v1";

const ADMIN_DASHBOARD_TABS = [
  "publications",
  "visitors",
  "top10",
  "promocodes"
];


function getInitialAdminDashboardTab() {

  try {

    const saved =
      window.localStorage
        .getItem(
          ADMIN_DASHBOARD_TAB_KEY
        );


    return ADMIN_DASHBOARD_TABS
      .includes(
        saved
      )
      ? saved
      : "publications";

  }
  catch {

    return "publications";

  }

}


function getGenerationDisplayName(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "—";
  }

  /*
   * Старые repair-записи могли сохранить весь системный prompt
   * вместо названия профессии.
   *
   * Ищем profession прямо внутри JSON, находящегося в prompt.
   */
  const professionMatch =
    text.match(
      /["']profession["']\s*:\s*["']([^"']+)["']/i
    );

  if (professionMatch?.[1]) {
    return professionMatch[1].trim();
  }

  /*
   * Защита интерфейса на случай другой поврежденной записи.
   */
  if (
    text.includes("Ты являешься редактором") ||
    text.includes("Текущий документ:") ||
    text.includes("Верни только JSON")
  ) {
    return "Восстановление инструкции";
  }

  return text.length > 100
    ? `${text.slice(0, 97)}...`
    : text;
}


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



  const [
    adminDashboardTab,
    setAdminDashboardTab
  ] =
    useState(
      getInitialAdminDashboardTab
    );


  function changeAdminDashboardTab(
    nextTab
  ) {

    const valid =
      ADMIN_DASHBOARD_TABS
        .includes(
          nextTab
        );


    const value =
      valid
        ? nextTab
        : "publications";


    setAdminDashboardTab(
      value
    );


    try {

      window.localStorage
        .setItem(
          ADMIN_DASHBOARD_TAB_KEY,
          value
        );

    }
    catch {
      /* UI state persistence is optional */
    }

  }


  /*
   * ADMIN_PUBLICATION_INBOX_UI_V1
   */
  const [
    publicationInbox,
    setPublicationInbox
  ] =
    useState([]);

  const [
    publicationInboxLoading,
    setPublicationInboxLoading
  ] =
    useState(false);

  const [
    publicationInboxError,
    setPublicationInboxError
  ] =
    useState("");

  const [
    publicationReviewBusy,
    setPublicationReviewBusy
  ] =
    useState(null);

  const [
    selectedPublicationInstruction,
    setSelectedPublicationInstruction
  ] =
    useState(null);


  const [
    stats,
    setStats
  ] =
    useState(null);

  const [
    statsError,
    setStatsError
  ] =
    useState(null);


  useEffect(() => {

    if (
      !isAdmin ||
      !token
    ) {

      setStats(null);

      return;
    }


    let cancelled =
      false;


    async function loadStats() {

      try {

        const data =
          await getGenerationStats(
            token
          );

        if (!cancelled) {

          setStats(data);

          setStatsError(null);

        }

      }
      catch(error) {

        if (!cancelled) {

          setStatsError(
            error.message
          );

        }

      }

    }


    loadStats();

    /*
     * Пока генерация идёт, стоимость
     * обновляется автоматически.
     */
    const timer =
      setInterval(
        loadStats,
        15000
      );


    return () => {

      cancelled = true;

      clearInterval(timer);

    };

  }, [
    isAdmin,
    token
  ]);



  async function loadPublicationInbox(
    silent = false
  ) {

    if (
      !isAdmin ||
      !token
    ) {

      setPublicationInbox([]);

      return;
    }


    if (!silent) {

      setPublicationInboxLoading(
        true
      );

    }


    try {

      const response =
        await fetch(
          "/api/public-generation/admin/inbox",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            },

            cache:
              "no-store"
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data?.error ||
          "Не удалось загрузить ящик публикаций."
        );

      }


      setPublicationInbox(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

      setPublicationInboxError(
        ""
      );

    }
    catch(error) {

      setPublicationInboxError(
        error?.message ||
        "Не удалось загрузить ящик публикаций."
      );

    }
    finally {

      if (!silent) {

        setPublicationInboxLoading(
          false
        );

      }

    }

  }


  useEffect(
    () => {

      if (
        !isAdmin ||
        !token
      ) {

        setPublicationInbox([]);

        return undefined;
      }


      loadPublicationInbox();


      const timer =
        setInterval(
          () => {

            loadPublicationInbox(
              true
            );

          },
          15000
        );


      return () => {

        clearInterval(
          timer
        );

      };

    },
    [
      isAdmin,
      token
    ]
  );


  async function reviewPublication(
    orderId,
    action
  ) {

    if (
      !token ||
      !orderId
    ) {
      return;
    }


    const isApprove =
      action ===
        "approve";


    const confirmed =
      window.confirm(
        isApprove
          ? "Опубликовать эту инструкцию в общем каталоге?"
          : "Отклонить публикацию этой инструкции?"
      );


    if (!confirmed) {
      return;
    }


    setPublicationReviewBusy(
      orderId
    );

    setPublicationInboxError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/public-generation/admin/orders/${encodeURIComponent(
            orderId
          )}/${action}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`
            },

            body:
              JSON.stringify({})
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          data?.error ||
          "Не удалось изменить статус публикации."
        );

      }


      setPublicationInbox(
        current =>
          current.filter(
            item =>
              item.id !==
                orderId
          )
      );


      if (
        selectedPublicationInstruction
          ?.orderId ===
        orderId
      ) {

        setSelectedPublicationInstruction(
          null
        );

      }

    }
    catch(error) {

      setPublicationInboxError(
        error?.message ||
        "Не удалось изменить статус публикации."
      );

    }
    finally {

      setPublicationReviewBusy(
        null
      );

    }

  }


  return (

    <section className={styles.panel}>

      <div className={styles.actions}>

        <AddInstructionButton
          onImportCreated={
            onImportCreated
          }
        />

        <GenerateInstructionButton />
                  <AutoGenerationToggle />

          {/*
            ADMIN_PUBLICATION_BADGE_V1
          */}
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
                    publicationInbox.length
                  }
                </strong>

              </div>
            )
          }

      </div>

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


              {
                publicationInboxLoading &&
                publicationInbox.length === 0
                  ? (
                    <div
                      className={
                        styles.publicationEmpty
                      }
                    >
                      Загружаем новые инструкции...
                    </div>
                  )
                  : publicationInbox.length === 0
                    ? (
                      <div
                        className={
                          styles.publicationEmpty
                        }
                      >
                        Новых инструкций
                        на публикацию нет.
                      </div>
                    )
                    : (
                      <div
                        className={
                          styles.publicationList
                        }
                      >

                        {
                          publicationInbox.map(
                            item => (

                              <div
                                className={
                                  styles.publicationCard
                                }
                                key={
                                  item.id
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

                                        setSelectedPublicationInstruction({
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
                                      publicationReviewBusy ===
                                        item.id
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
                                      publicationReviewBusy ===
                                        item.id
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

                            )
                          )
                        }

                      </div>
                    )
              }


              {
                selectedPublicationInstruction &&
                (
                  <div
                    className={
                      styles.publicationModalOverlay
                    }
                    onMouseDown={
                      event => {

                        if (
                          event.target ===
                            event.currentTarget
                        ) {

                          setSelectedPublicationInstruction(
                            null
                          );

                        }

                      }
                    }
                  >

                    <div
                      className={
                        styles.publicationModal
                      }
                    >

                      <div
                        className={
                          styles.publicationModalHeader
                        }
                      >

                        <strong>
                          Просмотр инструкции
                        </strong>

                        <button
                          type="button"
                          className={
                            styles.publicationModalClose
                          }
                          onClick={
                            () =>
                              setSelectedPublicationInstruction(
                                null
                              )
                          }
                          aria-label="Закрыть"
                        >
                          ×
                        </button>

                      </div>


                      <div
                        className={
                          styles.publicationModalContent
                        }
                      >

                        <PrivateInstructionView
                          compact
                          instruction={
                            selectedPublicationInstruction
                              .instruction
                          }
                        />

                      </div>

                    </div>

                  </div>
                )
              }

            </div>
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
          <div className={styles.statsBlock}>

            <div className={styles.statsHeader}>

              <div>

                <div className={styles.statsEyebrow}>
                  YandexGPT
                </div>

                <h2 className={styles.statsTitle}>
                  Расходы на генерацию
                </h2>

              </div>

              {
                stats?.trackingStarted &&
                (
                  <div className={styles.tracking}>
                    учёт с{" "}
                    {
                      new Date(
                        stats.trackingStarted
                      )
                        .toLocaleString(
                          "ru-RU"
                        )
                    }
                  </div>
                )
              }

            </div>


            {
              statsError &&
              (
                <div className={styles.statsError}>
                  {statsError}
                </div>
              )
            }


            {
              stats &&
              (
                <>
                  <div className={styles.cards}>

                    <div className={styles.card}>

                      <span className={styles.cardLabel}>
                        Сегодня
                      </span>

                      <strong className={styles.cardValue}>
                        {
                          number(
                            stats.today
                              ?.generations
                          )
                        }
                      </strong>

                      <span className={styles.cardMeta}>
                        генераций ·{" "}
                        {
                          rub(
                            stats.today
                              ?.costRub
                          )
                        }
                      </span>

                    </div>


                    <div className={styles.card}>

                      <span className={styles.cardLabel}>
                        За месяц
                      </span>

                      <strong className={styles.cardValue}>
                        {
                          rub(
                            stats.month
                              ?.costRub
                          )
                        }
                      </strong>

                      <span className={styles.cardMeta}>
                        {
                          number(
                            stats.month
                              ?.generations
                          )
                        }
                        {" "}
                        генераций
                      </span>

                    </div>


                    <div className={styles.card}>

                      <span className={styles.cardLabel}>
                        Всего
                      </span>

                      <strong className={styles.cardValue}>
                        {
                          rub(
                            stats.total
                              ?.costRub
                          )
                        }
                      </strong>

                      <span className={styles.cardMeta}>
                        {
                          number(
                            stats.total
                              ?.apiCalls
                          )
                        }
                        {" "}
                        API-запросов
                      </span>

                    </div>


                    <div className={styles.card}>

                      <span className={styles.cardLabel}>
                        Средняя генерация
                      </span>

                      <strong className={styles.cardValue}>
                        {
                          rub(
                            stats.total
                              ?.averageCostRub
                          )
                        }
                      </strong>

                      <span className={styles.cardMeta}>
                        {
                          number(
                            stats.total
                              ?.totalTokens
                          )
                        }
                        {" "}
                        токенов всего
                      </span>

                    </div>

                  </div>


                  {
                    stats.recent
                      ?.length > 0 &&
                    (
                      <div className={styles.tableWrap}>

                        <div className={styles.tableTitle}>
                          Последние операции
                        </div>

                        <table className={styles.table}>

                          <thead>
                            <tr>
                              <th>
                                 Тип
                               </th>

                               <th>
                                 Профессия
                               </th>

                              <th>
                                API
                              </th>

                              <th>
                                Вход
                              </th>

                              <th>
                                Выход
                              </th>

                              <th>
                                Стоимость
                              </th>
                            </tr>
                          </thead>

                          <tbody>

                            {
                              stats.recent
                                .slice(
                                  0,
                                  10
                                )
                                .map(
                                  item => (

                                    <tr key={item.id}>

                                      <td>
                                         {
                                           getGenerationTypeLabel(
                                             item.source
                                           )
                                         }
                                       </td>

                                       <td>
                                         {
                                           getGenerationDisplayName(
                                             item.profession
                                           )
                                         }
                                       </td>

                                      <td>
                                        {
                                          number(
                                            item.apiCalls
                                          )
                                        }
                                      </td>

                                      <td>
                                        {
                                          number(
                                            item.inputTokens
                                          )
                                        }
                                      </td>

                                      <td>
                                        {
                                          number(
                                            item.outputTokens
                                          )
                                        }
                                      </td>

                                      <td>
                                        <strong>
                                          {
                                            rub(
                                              item.costRub
                                            )
                                          }
                                        </strong>
                                      </td>

                                    </tr>

                                  )
                                )
                            }

                          </tbody>

                        </table>

                      </div>
                    )
                  }

                </>
              )
            }

          </div>
        )
      }


      {
        importId &&
        (
          <div className={styles.importBlock}>

            <ImportManager

              importId={
                importId
              }

              onComplete={() => {
                onImportCreated(null);
              }}

              onRefresh={
                onRefresh
              }

            />

          </div>
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
