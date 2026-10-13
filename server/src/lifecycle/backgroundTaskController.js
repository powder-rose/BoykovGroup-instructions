export function createBackgroundTaskController() {

  let accepting =
    true;

  let stopPromise =
    null;


  const activeTasks =
    new Set();

  const immediateHandles =
    new Set();

  const timeoutHandles =
    new Set();


  function runTracked(
    callback
  ) {

    const task =
      Promise
        .resolve()
        .then(
          callback
        );


    activeTasks.add(
      task
    );


    task.then(
      () => {

        activeTasks.delete(
          task
        );

      },

      () => {

        activeTasks.delete(
          task
        );

      }
    );


    return task;

  }


  function scheduleImmediate(
    callback
  ) {

    if (
      !accepting
    ) {

      return false;

    }


    const handle =
      setImmediate(
        () => {

          immediateHandles.delete(
            handle
          );


          if (
            !accepting
          ) {

            return;

          }


          void runTracked(
            callback
          )
          .catch(
            error => {

              console.error(
                "[BackgroundTask] failed:",
                error
              );

            }
          );

        }
      );


    immediateHandles.add(
      handle
    );


    return true;

  }


  function scheduleTimeout(
    callback,
    delayMs
  ) {

    if (
      !accepting
    ) {

      return false;

    }


    const handle =
      setTimeout(
        () => {

          timeoutHandles.delete(
            handle
          );


          if (
            !accepting
          ) {

            return;

          }


          void runTracked(
            callback
          )
          .catch(
            error => {

              console.error(
                "[BackgroundTask] failed:",
                error
              );

            }
          );

        },
        delayMs
      );


    timeoutHandles.add(
      handle
    );


    if (
      typeof handle.unref ===
      "function"
    ) {

      handle.unref();

    }


    return true;

  }


  function stop() {

    if (
      stopPromise
    ) {

      return stopPromise;

    }


    accepting =
      false;


    for (
      const handle
      of immediateHandles
    ) {

      clearImmediate(
        handle
      );

    }


    immediateHandles.clear();


    for (
      const handle
      of timeoutHandles
    ) {

      clearTimeout(
        handle
      );

    }


    timeoutHandles.clear();


    stopPromise =
      (async () => {

        while (
          activeTasks.size >
          0
        ) {

          await Promise.allSettled(
            [
              ...activeTasks
            ]
          );

        }

      })();


    return stopPromise;

  }


  return {
    scheduleImmediate,
    scheduleTimeout,
    stop
  };

}
