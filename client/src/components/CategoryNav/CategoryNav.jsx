import styles from "./CategoryNav.module.css";

//    (href="#"),      
// ,   .    , 
//   href.
const NAV_ITEMS = [
  { label: " " },
  { label: " " },
  { label: "" },
  { divider: true },
  { label: "  " },
  { label: " " },
  { label: " " },
];

function handlePlaceholderClick(e) {
  e.preventDefault();
}

/**         .   . */
export default function CategoryNav() {
  return (
    <nav className={styles.nav} aria-label=" ">
      {NAV_ITEMS.map((item, idx) =>
        item.divider ? (
          <span key={`divider-${idx}`} className={styles.divider} aria-hidden="true" />
        ) : (
          <a key={item.label} href="#" className={styles.link} onClick={handlePlaceholderClick}>
            {item.label}
          </a>
        )
      )}
    </nav>
  );
}
