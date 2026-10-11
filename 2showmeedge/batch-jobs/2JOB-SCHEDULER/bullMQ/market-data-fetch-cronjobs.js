const { Queue, Worker } = require('bullmq');
const { exec } = require('child_process');
const path = require('path');

// Express & Bull Board Imports
const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const connection = {
  host: '127.0.0.1',
  port: 6379,
};

const QUEUE_NAME = 'multi-script-tasks';
const taskQueue = new Queue(QUEUE_NAME, { connection });

// -------------------------------------------------------------
// SETUP BULL-BOARD UI
// -------------------------------------------------------------
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/ui');

createBullBoard({
  queues: [new BullMQAdapter(taskQueue)],
  serverAdapter: serverAdapter,
});

const app = express();
app.use('/ui', serverAdapter.getRouter());

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`BullMQ Monitor UI is running at http://localhost:${PORT}/ui`);
});
// -------------------------------------------------------------

// Your Job Configurations & Logic
const JOB_CONFIGS = [
  {
    name: 'job1-10min-weekdays',
    scriptPath: path.join(__dirname, 'jobs/job1/runner.sh'),
    cron: '*/10 4-16 * * 1-5',
  },
  // Add other jobs here...
];
        
async function setupCronJobs() {
  const existingRepeatables = await taskQueue.getRepeatableJobs();
  for (const job of existingRepeatables) {
    await taskQueue.removeRepeatableByKey(job.key);
  }

  for (const config of JOB_CONFIGS) {
    await taskQueue.add(
      config.name,
      { scriptPath: config.scriptPath },
      { repeat: { pattern: config.cron } }
    );
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { scriptPath } = job.data;
    return new Promise((resolve, reject) => {
      exec(scriptPath, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });
  },
  { connection }
);

setupCronJobs();