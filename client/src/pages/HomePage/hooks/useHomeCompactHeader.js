import {
  useEffect,
  useRef,
  useState
} from "react";


const SHOW_THRESHOLD =
  -4;

const HIDE_THRESHOLD =
  16;


export default function useHomeCompactHeader() {

  const [
    isCompactHeader,
    setIsCompactHeader
  ] =
    useState(false);


  const stickyIntroRef =
    useRef(null);

  const stickyTriggerRef =
    useRef(null);


  useEffect(() => {

    const intro =
      stickyIntroRef.current;


    if (!intro) {
      return undefined;
    }


    let frameId =
      null;


    const update =
      () => {

        frameId =
          null;


        const top =
          intro
            .getBoundingClientRect()
            .top;


        setIsCompactHeader(
          current => {

            if (
              current &&
              top >= HIDE_THRESHOLD
            ) {
              return false;
            }


            if (
              !current &&
              top <= SHOW_THRESHOLD
            ) {
              return true;
            }


            return current;
          }
        );

      };


    const scheduleUpdate =
      () => {

        if (
          frameId !== null
        ) {
          return;
        }


        frameId =
          window.requestAnimationFrame(
            update
          );

      };


    update();


    window.addEventListener(
      "scroll",
      scheduleUpdate,
      {
        passive: true
      }
    );

    window.addEventListener(
      "resize",
      scheduleUpdate
    );


    return () => {

      window.removeEventListener(
        "scroll",
        scheduleUpdate
      );

      window.removeEventListener(
        "resize",
        scheduleUpdate
      );


      if (
        frameId !== null
      ) {
        window.cancelAnimationFrame(
          frameId
        );
      }

    };

  }, []);


  return {
    isCompactHeader,
    stickyIntroRef,
    stickyTriggerRef
  };

}
