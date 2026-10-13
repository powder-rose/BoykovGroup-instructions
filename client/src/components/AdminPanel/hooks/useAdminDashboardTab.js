import {
  useState
} from "react";


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


export default function useAdminDashboardTab() {

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
      return;
    }

  }


  return {
    adminDashboardTab,
    changeAdminDashboardTab
  };

}
