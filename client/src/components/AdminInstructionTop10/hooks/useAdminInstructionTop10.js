import {
  useEffect,
  useState
} from "react";


export default function useAdminInstructionTop10(
  token
) {

  const [
    period,
    setPeriod
  ] =
    useState(
      "total"
    );

  const [
    data,
    setData
  ] =
    useState(null);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");


  useEffect(() => {

    if (!token) {

      setData(
        null
      );

      setLoading(
        false
      );

      return undefined;

    }


    let cancelled =
      false;


    async function loadStats(
      silent = false
    ) {

      if (!silent) {

        setLoading(
          true
        );

      }


      try {

        setError(
          ""
        );


        const response =
          await fetch(
            `/api/admin/instruction-popularity?period=${encodeURIComponent(
              period
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              },

              cache:
                "no-store"
            }
          );


        const result =
          await response
            .json()
            .catch(
              () => ({})
            );


        if (!response.ok) {

          throw new Error(
            result?.error ||
            `Ошибка статистики (${response.status})`
          );

        }


        if (!cancelled) {

          setData(
            result
          );

        }

      }
      catch(loadError) {

        if (!cancelled) {

          setError(
            loadError?.message ||
            "Не удалось загрузить статистику."
          );

        }

      }
      finally {

        if (
          !cancelled &&
          !silent
        ) {

          setLoading(
            false
          );

        }

      }

    }


    void loadStats();


    const timer =
      window.setInterval(
        () => {

          void loadStats(
            true
          );

        },
        60000
      );


    return () => {

      cancelled =
        true;


      window.clearInterval(
        timer
      );

    };

  }, [
    token,
    period
  ]);


  const items =
    Array.isArray(
      data?.items
    )
      ? data.items
      : [];


  return {
    period,
    setPeriod,
    items,
    loading,
    error
  };

}
