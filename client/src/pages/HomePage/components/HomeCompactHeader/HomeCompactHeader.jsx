import Navigation
  from "../../../../components/Navigation/Navigation.jsx";

import HomeHeaderControls
  from "../HomeHeaderControls/HomeHeaderControls.jsx";

import HomeHero
  from "../HomeHero/HomeHero.jsx";

import styles
  from "../../../../App.module.css";


export default function HomeCompactHeader({
  visible,
  query,
  onQueryChange
}) {

  return (
    <div
      className={[
        styles.safeCompactHeader,

        visible
          ? styles.safeCompactHeaderVisible
          : ""
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={
        !visible
      }
    >

      <div
        className={
          styles.safeCompactInner
        }
      >

        <div
          className={
            styles.stickyIntroCompact
          }
        >

          <HomeHeaderControls
            query={
              query
            }
            onQueryChange={
              onQueryChange
            }
          />


          <Navigation />


          <HomeHero
            compact
          />

        </div>

      </div>

    </div>
  );

}
