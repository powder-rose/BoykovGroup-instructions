import {
  useEffect,
  useRef
} from "react";

import {
  useLocation
} from "react-router-dom";

import {
  useSelector
} from "react-redux";

import {
  selectIsAdmin,
  selectIsRestoringSession
} from "../../store/authSlice.js";


const STORAGE_KEY =
  "boykovdocs_visitor_id_v1";


function createVisitorId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    return window.crypto
      .randomUUID()
      .replace(
        /-/g,
        "_"
      );

  }


  return (
    Date.now()
      .toString(36)
    +
    "_"
    +
    Math.random()
      .toString(36)
      .slice(2)
    +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


function getVisitorId() {

  try {

    let visitorId =
      window.localStorage
        .getItem(
          STORAGE_KEY
        );


    if (!visitorId) {

      visitorId =
        createVisitorId();


      window.localStorage
        .setItem(
          STORAGE_KEY,
          visitorId
        );

    }


    return visitorId;

  }
  catch {

    return null;

  }

}


export default function VisitorTracker() {

  const location =
    useLocation();


  const isAdmin =
    useSelector(
      selectIsAdmin
    );


  const isRestoring =
    useSelector(
      selectIsRestoringSession
    );


  const lastLocationRef =
    useRef(null);


  useEffect(() => {

    /*
     * Ждём восстановления auth.
     *
     * Иначе администратор мог бы
     * успеть засчитаться как обычный
     * посетитель до восстановления JWT.
     */
    if (
      isRestoring ||
      isAdmin
    ) {
      return;
    }


    const locationKey =
      location.pathname +
      location.search;


    if (
      lastLocationRef.current ===
      locationKey
    ) {
      return;
    }


    const visitorId =
      getVisitorId();


    if (!visitorId) {
      return;
    }


    lastLocationRef.current =
      locationKey;


    fetch(
      "/api/visitor-stats/visit",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            visitorId
          }),

        keepalive:
          true,

        cache:
          "no-store"
      }
    )
    .catch(
      () => {
        /*
         * Ошибка аналитики не должна
         * влиять на работу сайта.
         */
      }
    );

  }, [
    location.pathname,
    location.search,
    isAdmin,
    isRestoring
  ]);


  return null;

}
