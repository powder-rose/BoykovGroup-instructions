import styles from "./Navigation.module.css";


const links = [
  {
    label:
      "Охрана труда",

    href:
      "https://boykovgroup.ru/ohrana-truda"
  },

  {
    label:
      "Пожарная безопасность",

    href:
      "https://boykovgroup.ru/pozharnaya-bezopasnost"
  },

  {
    label:
      "Роспотребнадзор",

    href:
      "https://boykovgroup.ru/rospotrebnadzor"
  },

  {
    label:
      "ГО и ЧС",

    href:
      "https://boykovgroup.ru/go-chs"
  },

  {
    label:
      "Антитеррористическая безопасность",

    href:
      "https://boykovgroup.ru/antiterror"
  }
];


export default function Navigation() {

  return (
    <nav
      className={
        styles.navigation
      }
    >

      {
        links.map(
          (
            {
              label,
              href
            }
          ) => (

            <a
              key={
                label
              }
              href={
                href
              }
              className={
                styles.link
              }
            >
              {label}
            </a>

          )
        )
      }

    </nav>
  );

}
