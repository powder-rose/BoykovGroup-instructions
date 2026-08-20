import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Header from "../Header/Header.jsx";
import Navigation from "../Navigation/Navigation.jsx";

import SEO from "../SEO/SEO.jsx";

import styles from "./InstructionsCatalog.module.css";


export default function InstructionsCatalog() {

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {

    async function load() {

      try {

        const response = await fetch(
          "http://localhost:4000/api/instructions?page=1&pageSize=200"
        );

        const data = await response.json();

        setItems(data.items || []);

      } finally {

        setLoading(false);

      }

    }


    load();

  }, []);



  return (
    <div className={styles.page}>

      <SEO
        title="Инструкции по охране труда | БОЙКОВГРУПП"
        description="Готовые инструкции по охране труда для различных профессий. База документов по охране труда для организаций."
      />


      <div className={styles.siteHeader}>

        <Header
          query=""
          onQueryChange={() => {}}
        />

        <Navigation />

      </div>



      <main className={styles.content}>


        <h1>
          Инструкции по охране труда
        </h1>


        <p className={styles.description}>
          Готовые инструкции по охране труда для работников различных профессий.
        </p>



        {loading && (
          <p>
            Загрузка...
          </p>
        )}



        <div className={styles.grid}>

          {items.map((item) => (

            <Link
              key={item.id}
              to={`/instrukciya-po-ohrane-truda/${item.id}`}
              className={styles.card}
            >

              <h2>
                {item.title}
              </h2>

              <span>
                Открыть инструкцию →
              </span>


            </Link>

          ))}


        </div>


      </main>


    </div>
  );
}