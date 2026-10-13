import "dotenv/config";

import {
  createApp
} from "./app.js";

import {
  startDailyGenerationJob
} from "./jobs/dailyGenerationJob.js";

import {
  startDailySiteStatsEmailJob
} from "./jobs/dailySiteStatsEmailJob.js";

import {
  createGracefulShutdown
} from "./lifecycle/gracefulShutdown.js";

import {
  isAdminConfigured
} from "./services/authService.js";

import {
  ensureBulkImportWorker,
  waitForBulkImportWorker
} from "./services/bulkImportWorkerService.js";

import {
  recoverPublicGenerationOrders,
  stopPublicGenerationProcessing
} from "./services/publicPaidGenerationService.js";

import {
  isYandexGptConfigured
} from "./services/yandexGptService.js";


const app =
  createApp();


const PORT =
  process.env.PORT ||
  4000;


const parsedShutdownTimeout =
  Number.parseInt(
    process.env.SHUTDOWN_TIMEOUT_MS ||
    "15000",
    10
  );


const shutdownTimeoutMs =
  Number.isFinite(
    parsedShutdownTimeout
  ) &&
  parsedShutdownTimeout > 0
    ? parsedShutdownTimeout
    : 15_000;


let stopDailyGenerationJob =
  () => {};


let stopDailySiteStatsEmailJob =
  () => {};


/*
 * Первый recovery сразу при старте процесса.
 */
recoverPublicGenerationOrders();


const publicGenerationRecoveryTimer =
  setInterval(
    () => {

      try {

        recoverPublicGenerationOrders();

      }
      catch (error) {

        console.error(
          "[PublicGeneration] periodic recovery failed:",
          error
        );

      }

    },
    60 * 1000
  );


if (
  typeof publicGenerationRecoveryTimer.unref ===
  "function"
) {

  publicGenerationRecoveryTimer.unref();

}


const server =
  app.listen(
    PORT,
    () => {

      console.log(
        `Instructions API запущен на http://localhost:${PORT}`
      );


      if (
        !isYandexGptConfigured()
      ) {

        console.warn(
          "YandexGPT не настроен (нет YANDEX_API_KEY/YANDEX_FOLDER_ID) — генерация недостающих инструкций будет недоступна."
        );

      }


      if (
        !isAdminConfigured()
      ) {

        console.warn(
          "Учётная запись админа не настроена (нет ADMIN_LOGIN/ADMIN_PASSWORD_HASH) — вход в панель будет недоступен."
        );

      }


      void ensureBulkImportWorker();


      stopDailyGenerationJob =
        startDailyGenerationJob();


      stopDailySiteStatsEmailJob =
        startDailySiteStatsEmailJob();

    }
  );


const shutdown =
  createGracefulShutdown({
    server,

    timeoutMs:
      shutdownTimeoutMs,

    cleanup: [

      () => {

        clearInterval(
          publicGenerationRecoveryTimer
        );

      },


      async () => {

        await stopDailyGenerationJob();

      },


      async () => {

        await stopDailySiteStatsEmailJob();

      },


      async () => {

        await stopPublicGenerationProcessing();

      },


      async () => {

        await waitForBulkImportWorker();

      }

    ]
  });


async function handleShutdown(
  signal
) {

  console.log(
    `[Shutdown] ${signal} received`
  );


  try {

    await shutdown(
      signal
    );


    console.log(
      "[Shutdown] completed"
    );


    process.exit(
      0
    );

  }
  catch (error) {

    console.error(
      "[Shutdown] failed:",
      error
    );


    process.exit(
      1
    );

  }

}


process.once(
  "SIGTERM",
  () => {

    void handleShutdown(
      "SIGTERM"
    );

  }
);


process.once(
  "SIGINT",
  () => {

    void handleShutdown(
      "SIGINT"
    );

  }
);
