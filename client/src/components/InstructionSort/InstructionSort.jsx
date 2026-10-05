import styles from
  "./InstructionSort.module.css";


function getCurrentMode() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  return (
    params.get("sort") ===
      "popular"
  )
    ? "popular"
    : "newest";

}


export default function InstructionSort() {

  const currentMode =
    getCurrentMode();


  function chooseMode(
    mode
  ) {

    if (
      mode ===
      currentMode
    ) {
      return;
    }


    const url =
      new URL(
        window.location.href
      );


    if (
      mode ===
        "popular"
    ) {

      url.searchParams.set(
        "sort",
        "popular"
      );

    }
    else {

      url.searchParams.delete(
        "sort"
      );

    }


    window.location.assign(
      url.pathname +
      url.search +
      url.hash
    );

  }


  return (
    <div
      className={
        styles.root
      }
    >

      <span
        className={
          styles.label
        }
      >
        Сортировка:
      </span>


      <div
        className={
          styles.buttons
        }
      >

        <button
          type="button"
          className={[
            styles.button,

            currentMode ===
              "newest"
              ? styles.active
              : ""
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={
            currentMode ===
            "newest"
          }
          onClick={
            () =>
              chooseMode(
                "newest"
              )
          }
        >
          Сначала новые
        </button>


        <button
          type="button"
          className={[
            styles.button,

            currentMode ===
              "popular"
              ? styles.active
              : ""
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={
            currentMode ===
            "popular"
          }
          onClick={
            () =>
              chooseMode(
                "popular"
              )
          }
        >
          Популярные
        </button>

      </div>

    </div>
  );

}
