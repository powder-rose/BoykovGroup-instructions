const queue = [];

let running = false;

export function addToQueue(job) {
  queue.push(job);

  runWorker();
}

async function runWorker() {
  if (running) {
    return;
  }

  running = true;

  while (queue.length) {
    const job = queue.shift();

    try {
      await job();
    } catch (error) {
      console.error('Import worker error:', error);
    }
  }

  running = false;
}
