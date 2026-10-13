import {
  useEffect,
  useState
} from "react";


export default function useAdminVisitorStats(
  token
) {

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


    async function loadStats() {

      try {

        setError(
          ""
        );


        const response =
          await fetch(
            "/api/visitor-stats/admin",
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
            "Не удалось загрузить статистику посетителей."
          );

        }

      }
      finally {

        if (!cancelled) {

          setLoading(
            false
          );

        }

      }

    }


    function handleFocus() {

      void loadStats();

    }


    void loadStats();


    window.addEventListener(
      "focus",
      handleFocus
    );


    return () => {

      cancelled =
        true;


      window.removeEventListener(
        "focus",
        handleFocus
      );

    };

  }, [
    token
  ]);


  return {
    data,
    loading,
    error
  };

}
