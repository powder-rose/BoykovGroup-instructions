import "./AdminDashboardTabs.css";


const TABS = [
  {
    id:
      "publications",

    label:
      "Публикации"
  },

  {
    id:
      "visitors",

    label:
      "Посетители"
  },

  {
    id:
      "top10",

    label:
      "Топ-10"
  },

  {
    id:
      "promocodes",

    label:
      "Промокоды"
  }
];


export default function AdminDashboardTabs({
  activeTab,
  onChange
}) {

  return (
    <nav
      id="boykovAdminDashboardTabs"
      className="boykovAdminDashboardTabs"
      aria-label="Разделы административной панели"
    >

      <div
        className="boykovAdminDashboardTabs__inner"
        role="tablist"
      >

        {
          TABS.map(
            tab => {

              const active =
                tab.id ===
                activeTab;


              return (
                <button
                  key={
                    tab.id
                  }
                  type="button"
                  role="tab"
                  aria-selected={
                    active
                  }
                  tabIndex={
                    active
                      ? 0
                      : -1
                  }
                  className={[
                    "boykovAdminDashboardTabs__button",

                    active
                      ? "boykovAdminDashboardTabs__button--active"
                      : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={
                    () =>
                      onChange(
                        tab.id
                      )
                  }
                >
                  {tab.label}
                </button>
              );

            }
          )
        }

      </div>

    </nav>
  );

}
