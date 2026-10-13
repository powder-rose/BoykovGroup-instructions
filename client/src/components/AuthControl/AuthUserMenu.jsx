import styles from
  "./AuthControl.module.css";


export default function AuthUserMenu({

  user,
  isMenuOpen,
  setMenuOpen,
  dropdownRef,
  onLogout

}) {

  const accountName =
    user.email ||
    user.login ||
    "аккаунт";


  return (
    <div
      ref={
        dropdownRef
      }
      className={
        styles.accountDropdown
      }
    >

      <button
        type="button"
        className={
          styles.accountTrigger
        }
        aria-haspopup="menu"
        aria-expanded={
          isMenuOpen
        }
        onClick={
          (event) => {

            event.stopPropagation();

            setMenuOpen(
              current =>
                !current
            );

          }
        }
      >

        <span
          className={
            styles.accountTriggerEmail
          }
        >
          [ {accountName} ]
        </span>


        <span
          className={
            styles.accountTriggerChevron
          }
          aria-hidden="true"
        >
          ▾
        </span>

      </button>


      <div
        className={
          styles.accountMenu
        }
        hidden={
          !isMenuOpen
        }
        role="menu"
      >

        <div
          className={
            styles.accountMenuHead
          }
        >

          <div
            className={
              styles.accountMenuLabel
            }
          >
            АККАУНТ
          </div>


          <div
            className={
              styles.accountMenuEmail
            }
          >
            {accountName}
          </div>

        </div>


        <div
          className={
            styles.accountMenuDivider
          }
        />


        <a
          href="/account/"
          className={
            styles.accountMenuItem
          }
          role="menuitem"
          onClick={
            () =>
              setMenuOpen(
                false
              )
          }
        >

          <span>
            Личный кабинет
          </span>


          <span
            className={
              styles.accountMenuArrow
            }
          >
            →
          </span>

        </a>


        <button
          type="button"
          className={[
            styles.accountMenuItem,
            styles.accountMenuLogout
          ]
            .filter(Boolean)
            .join(" ")}
          role="menuitem"
          onClick={
            () => {

              setMenuOpen(
                false
              );

              onLogout();

            }
          }
        >
          Выйти
        </button>

      </div>

    </div>
  );

}
