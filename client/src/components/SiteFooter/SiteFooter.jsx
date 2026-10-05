import "./SiteFooter.css";


function FooterItem({
  label,
  children
}) {

  return (
    <div
      className="boykovFooterReq__item"
    >

      <span
        className="boykovFooterReq__label"
      >
        {label}
      </span>

      {children}

    </div>
  );

}


export default function SiteFooter() {

  return (
    <footer
      id="boykov-site-footer"
      className="boykovSiteFooter"
    >

      <section
        id="boykov-footer-requisites"
        className="boykovFooterReq"
      >

        <div
          className="boykovFooterReq__inner"
        >

          <div
            className="boykovFooterReq__head"
          >

            <span
              className="boykovFooterReq__eyebrow"
            >
              Реквизиты юридического лица
            </span>

          </div>


          <div
            className="boykovFooterReq__grid"
          >

            <div
              className="boykovFooterReq__column"
            >

              <FooterItem
                label="Полное наименование"
              >
                <strong
                  className="boykovFooterReq__value"
                >
                  Общество с ограниченной ответственностью «СПЕЦКОНС»
                </strong>
              </FooterItem>


              <FooterItem
                label="Бренд"
              >
                <span
                  className="boykovFooterReq__value"
                >
                  БОЙКОВГРУПП
                </span>
              </FooterItem>


              <FooterItem
                label="Руководитель"
              >
                <span
                  className="boykovFooterReq__value"
                >
                  Бойков Николай Александрович, генеральный директор
                </span>
              </FooterItem>

            </div>


            <div
              className="boykovFooterReq__column"
            >

              <div
                className="boykovFooterReq__numbers"
              >

                <FooterItem
                  label="ИНН"
                >
                  <span
                    className="boykovFooterReq__value"
                  >
                    5027310150
                  </span>
                </FooterItem>


                <FooterItem
                  label="КПП"
                >
                  <span
                    className="boykovFooterReq__value"
                  >
                    502701001
                  </span>
                </FooterItem>

              </div>


              <FooterItem
                label="ОГРН"
              >
                <span
                  className="boykovFooterReq__value"
                >
                  1225000108618
                </span>
              </FooterItem>


              <FooterItem
                label="Лицензия МЧС"
              >
                <span
                  className="boykovFooterReq__value"
                >
                  Л014-00101-50/00624678
                </span>
              </FooterItem>


              <FooterItem
                label="Образовательная лицензия"
              >
                <span
                  className="boykovFooterReq__value"
                >
                  № Л035-01255-50-06059814
                </span>
              </FooterItem>

            </div>


            <div
              className="boykovFooterReq__column"
            >

              <div
                className="boykovFooterReq__contactRow"
              >

                <FooterItem
                  label="Телефон"
                >
                  <a
                    className="
                      boykovFooterReq__value
                      boykovFooterReq__link
                    "
                    href="tel:+78002012043"
                  >
                    +7 (800) 201-20-43
                  </a>
                </FooterItem>


                <FooterItem
                  label="Email"
                >
                  <a
                    className="
                      boykovFooterReq__value
                      boykovFooterReq__link
                    "
                    href="mailto:contact@boykovgroup.ru"
                  >
                    contact@boykovgroup.ru
                  </a>
                </FooterItem>

              </div>


              <FooterItem
                label="Юридический адрес"
              >
                <address
                  className="
                    boykovFooterReq__value
                    boykovFooterReq__address
                  "
                >
                  140054, Московская область, г. о. Котельники,
                  г. Котельники, мкр. Парковый, д. 2, помещ. 0181
                </address>
              </FooterItem>


              <FooterItem
                label="Московский офис"
              >
                <address
                  className="
                    boykovFooterReq__value
                    boykovFooterReq__address
                  "
                >
                  Москва, проспект Мира, 101с1,
                  БЦ «Гипромез», офис №1308
                </address>
              </FooterItem>

            </div>

          </div>

        </div>

      </section>


      <div
        className="boykovSiteFooter__inner"
      >

        <nav
          className="boykovSiteFooter__links"
          aria-label="Правовая информация"
        >

          <a
            className="boykovSiteFooter__link"
            href="/privacy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Политика в отношении обработки персональных данных
          </a>


          <a
            className="boykovSiteFooter__link"
            href="/user-agreement/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Пользовательское соглашение
          </a>


          <a
            className="boykovSiteFooter__link"
            href="/offer/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Публичная оферта
          </a>

        </nav>

      </div>

    </footer>
  );

}
