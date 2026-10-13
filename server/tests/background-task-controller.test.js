import assert from "node:assert/strict";
import {
  setTimeout as delay
} from "node:timers/promises";
import test from "node:test";

import {
  createBackgroundTaskController
} from "../src/lifecycle/backgroundTaskController.js";


test(
  "background controller waits for an already running task",
  async () => {

    const controller =
      createBackgroundTaskController();


    let releaseTask = null;
    let markStarted = null;


    const started =
      new Promise(
        resolve => {

          markStarted =
            resolve;

        }
      );


    const release =
      new Promise(
        resolve => {

          releaseTask =
            resolve;

        }
      );


    controller.scheduleImmediate(
      async () => {

        markStarted();

        await release;

      }
    );


    await started;


    let stopped =
      false;


    const stopPromise =
      controller
        .stop()
        .then(
          () => {

            stopped =
              true;

          }
        );


    await delay(
      20
    );


    assert.equal(
      stopped,
      false
    );


    releaseTask();


    await stopPromise;


    assert.equal(
      stopped,
      true
    );

  }
);


test(
  "background controller cancels queued immediate work on stop",
  async () => {

    const controller =
      createBackgroundTaskController();


    let calls =
      0;


    controller.scheduleImmediate(
      async () => {

        calls++;

      }
    );


    await controller.stop();


    await delay(
      20
    );


    assert.equal(
      calls,
      0
    );

  }
);


test(
  "background controller cancels delayed retry work on stop",
  async () => {

    const controller =
      createBackgroundTaskController();


    let calls =
      0;


    controller.scheduleTimeout(
      async () => {

        calls++;

      },
      25
    );


    await controller.stop();


    await delay(
      50
    );


    assert.equal(
      calls,
      0
    );

  }
);


test(
  "background controller rejects new work after shutdown starts",
  async () => {

    const controller =
      createBackgroundTaskController();


    await controller.stop();


    assert.equal(
      controller.scheduleImmediate(
        async () => {}
      ),
      false
    );


    assert.equal(
      controller.scheduleTimeout(
        async () => {},
        10
      ),
      false
    );

  }
);
