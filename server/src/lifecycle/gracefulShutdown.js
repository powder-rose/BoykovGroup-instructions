function closeServer(
  server
) {

  return new Promise(
    (resolve, reject) => {

      server.close(
        error => {

          if (error) {

            reject(
              error
            );

            return;

          }


          resolve();

        }
      );

    }
  );

}


export function createGracefulShutdown({
  server,
  cleanup = [],
  timeoutMs = 15_000
}) {

  let shutdownPromise =
    null;


  return function shutdown(
    signal
  ) {

    if (
      shutdownPromise
    ) {

      return shutdownPromise;

    }


    shutdownPromise =
      (async () => {

        /*
         * Сразу перестаём принимать новые
         * HTTP-соединения.
         *
         * server.close() ждёт завершения
         * уже активных запросов.
         */
        const serverClosePromise =
          closeServer(
            server
          );


        /*
         * Параллельно останавливаем
         * фоновые части приложения.
         */
        const cleanupPromise =
          Promise.all(
            cleanup.map(
              callback =>
                callback(
                  signal
                )
            )
          );


        const gracefulWork =
          Promise.all([
            serverClosePromise,
            cleanupPromise
          ]);


        let timeoutId =
          null;


        const timeoutPromise =
          new Promise(
            resolve => {

              timeoutId =
                setTimeout(
                  () => {

                    /*
                     * Если HTTP-соединение зависло,
                     * после grace period принудительно
                     * закрываем оставшиеся соединения.
                     */
                    if (
                      typeof server.closeAllConnections ===
                      "function"
                    ) {

                      server.closeAllConnections();

                    }


                    resolve();

                  },
                  timeoutMs
                );

            }
          );


        try {

          await Promise.race([
            gracefulWork,
            timeoutPromise
          ]);

        }
        finally {

          if (
            timeoutId !==
            null
          ) {

            clearTimeout(
              timeoutId
            );

          }

        }

      })();


    return shutdownPromise;

  };

}
