import AdminVisitorStatsContent
  from "./AdminVisitorStatsContent.jsx";

import useAdminVisitorStats
  from "./hooks/useAdminVisitorStats.js";

import "./AdminVisitorStats.css";


export default function AdminVisitorStats({
  token,
  hidden = false
}) {

  const {
    data,
    loading,
    error
  } =
    useAdminVisitorStats(
      token
    );


  return (
    <section
      id="boykovVisitorStats"
      className={[
        "boykovVisitorStats",

        hidden
          ? "boykovAdminDashboardSection--hidden"
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-boykov-admin-tab-section="visitors"
    >

      <div
        className="boykovVisitorStats__header"
      >

        <div
          className="boykovVisitorStats__eyebrow"
        >
          СТАТИСТИКА
        </div>

        <h2
          className="boykovVisitorStats__title"
        >
          Посетители сайта
        </h2>

        <p
          className="boykovVisitorStats__description"
        >
          Уникальные посетители и просмотры страниц
        </p>

      </div>


      <AdminVisitorStatsContent
        data={
          data
        }
        loading={
          loading
        }
        error={
          error
        }
      />

    </section>
  );

}
