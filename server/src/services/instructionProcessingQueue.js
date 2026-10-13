const queue = [];

const tasks = new Map();

let isProcessing = false;

const MAX_CONCURRENT = 2;

export function addToQueue(items, processor) {
  const batchId = `batch-${Date.now()}`;

  const batch = {
    id: batchId,

    total: items.length,

    completed: 0,

    failed: 0,

    status: 'waiting',

    createdAt: new Date().toISOString(),
  };

  tasks.set(batchId, batch);

  items.forEach(item => {
    queue.push({
      batchId,

      item,

      processor,
    });
  });

  runQueue();

  return batchId;
}

async function runQueue() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  while (queue.length) {
    const workers = [];

    for (let i = 0; i < MAX_CONCURRENT && queue.length; i++) {
      workers.push(processItem(queue.shift()));
    }

    await Promise.all(workers);
  }

  isProcessing = false;
}

async function processItem(job) {
  const batch = tasks.get(job.batchId);

  if (!batch) {
    return;
  }

  if (batch.completed + batch.failed === 0) {
    batch.status = 'processing';
  }

  try {
    await job.processor(job.item);

    batch.completed++;
  } catch (error) {
    console.error('Ошибка обработки:', error);

    batch.failed++;
  }

  if (batch.completed + batch.failed === batch.total) {
    batch.status = 'completed';

    batch.finishedAt = new Date().toISOString();
  }
}

export function getQueueStatus(batchId) {
  return tasks.get(batchId) || null;
}
