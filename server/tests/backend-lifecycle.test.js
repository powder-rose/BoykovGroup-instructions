import assert from "node:assert/strict";
import test from "node:test";

import {
  createGracefulShutdown
} from "../src/lifecycle/gracefulShutdown.js";


function createFakeServer() {

  let closeCalls = 0;


  return {

    get closeCalls() {
      return closeCalls;
    },


    close(callback) {

      closeCalls++;

      queueMicrotask(
        () => callback()
      );

    }

  };

}


test(
  "graceful shutdown closes HTTP server exactly once",
  async () => {

    const server =
      createFakeServer();


    const shutdown =
      createGracefulShutdown({
        server,
        cleanup: []
      });


    await Promise.all([
      shutdown("SIGTERM"),
      shutdown("SIGINT")
    ]);


    assert.equal(
      server.closeCalls,
      1
    );

  }
);


test(
  "graceful shutdown runs cleanup callbacks exactly once",
  async () => {

    const server =
      createFakeServer();

    const receivedSignals = [];

    let firstCleanupCalls = 0;
    let secondCleanupCalls = 0;


    const shutdown =
      createGracefulShutdown({
        server,

        cleanup: [

          async signal => {

            firstCleanupCalls++;

            receivedSignals.push(
              signal
            );

          },


          async () => {

            secondCleanupCalls++;

          }

        ]
      });


    await Promise.all([
      shutdown("SIGTERM"),
      shutdown("SIGTERM")
    ]);


    assert.equal(
      firstCleanupCalls,
      1
    );


    assert.equal(
      secondCleanupCalls,
      1
    );


    assert.deepEqual(
      receivedSignals,
      [
        "SIGTERM"
      ]
    );

  }
);


test(
  "graceful shutdown waits for asynchronous cleanup",
  async () => {

    const server =
      createFakeServer();

    let cleanupFinished =
      false;


    const shutdown =
      createGracefulShutdown({
        server,

        cleanup: [

          async () => {

            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  25
                )
            );


            cleanupFinished =
              true;

          }

        ]
      });


    await shutdown(
      "SIGTERM"
    );


    assert.equal(
      cleanupFinished,
      true
    );

  }
);


test(
  "graceful shutdown force-closes connections after timeout",
  {
    timeout:
      250
  },
  async () => {

    let closeAllConnectionsCalls =
      0;

    let closeCallback =
      null;


    const server = {

      close(callback) {

        /*
         * Имитируем активный HTTP-request,
         * который сам не завершается.
         */
        closeCallback =
          callback;

      },


      closeAllConnections() {

        closeAllConnectionsCalls++;

        /*
         * В настоящем Node после принудительного
         * закрытия соединений server.close()
         * сможет завершиться.
         */
        queueMicrotask(
          () => {

            if (
              closeCallback
            ) {

              closeCallback();

            }

          }
        );

      }

    };


    const shutdown =
      createGracefulShutdown({
        server,

        cleanup: [],

        timeoutMs:
          25
      });


    await shutdown(
      "SIGTERM"
    );


    assert.equal(
      closeAllConnectionsCalls,
      1
    );

  }
);