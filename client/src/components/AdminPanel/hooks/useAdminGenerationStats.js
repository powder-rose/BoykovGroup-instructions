import {
  useEffect,
  useState
} from "react";

import {
  getGenerationStats
} from "../../../api/instructionsApi.js";


export default function useAdminGenerationStats({

  isAdmin,
  token

}) {

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


  return {
    stats,
    statsError
  };

}
