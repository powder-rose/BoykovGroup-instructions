import {
  useEffect,
  useRef,
  useState
} from "react";

import styles
  from "./InstructionList.module.css";


export default function RevealItem({
  children,
  delay = 0
}) {

  const itemRef =
    useRef(null);

  const [
    isVisible,
    setIsVisible
  ] = useState(false);


  useEffect(() => {

    const node =
      itemRef.current;


    if (!node) {
      return undefined;
    }


    const prefersReducedMotion =
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;


    if (
      prefersReducedMotion ||
      typeof IntersectionObserver ===
        "undefined"
    ) {

      setIsVisible(
        true
      );

      return undefined;

    }


    const observer =
      new IntersectionObserver(
        ([entry]) => {

          if (
            !entry.isIntersecting
          ) {

            return;

          }


          setIsVisible(
            true
          );


          observer.unobserve(
            entry.target
          );

        },

        {
          threshold:
            0.06,

          rootMargin:
            "0px 0px -2% 0px"
        }
      );


    observer.observe(
      node
    );


    return () => {

      observer.disconnect();

    };

  }, []);


  return (
    <li
      ref={
        itemRef
      }
      className={[
        styles.item,

        isVisible
          ? styles.visible
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--reveal-delay":
          `${delay}ms`
      }}
    >
      {children}
    </li>
  );

}
