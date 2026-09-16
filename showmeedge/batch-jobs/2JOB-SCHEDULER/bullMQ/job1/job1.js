const { Queue, Worker, QueueEvents } = require('bullmq');
const { exec } = require('child_process');
const path = require('path');

const connection = {
  host: '127.0.0.1',
  port: 6379,
};

const QUEUE_NAME = 'scheduled-shell-tasks';

// ----- 1. Initialize Queue
const taskQueue = new Queue(QUEUE_NAME, { connection });

// ----------- funtion setupCronJob ------------------------------------------------
async function setupCronJob22() {

// Fetch existing scheduled repeatable jobs in BullMQ
  const existingSchedulers = await taskQueue.getJobSchedulers();

//  Clear old schedulers by key
  for (const scheduler of existingSchedulers) {
    await taskQueue.removeJobScheduler(scheduler.key);
  }

  // Schedule job: every 10 mins, 4am - 4:50pm, Mon-Fri
  await taskQueue.add(
    'run-shell-script',
    {},
    {
      repeat: {
        pattern: '*/1 4-23 * * 1-5',   // cron pattern repeat every /1 minute  4 am to 16  Mon-Fri that is 1-5
      },
    }
  );

  console.log('Cron job scheduled in BullMQ (Mon-Fri, 04:00-16:50 every 10m).');
} // --- end of setupCronJob()

// --------------- 2. Setup Job Scheduler
async function setupCronJob() {
  // upsertJobScheduler automatically creates or updates the cron job safely
  await taskQueue.upsertJobScheduler(
    'every-1-min-script-scheduler', // Unique Scheduler ID
    {
      pattern: '*/1 21-22 * * 1-5', // Runs every 1 minute
    },
    {
      name: 'run-shell-script', // Job name received by the worker
      data: {},
    }
  );

  console.log('Cron job scheduler registered in BullMQ (Every 1 minute).');
}

// ---------- 2. Initialize Worker ---------------------------
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`[${new Date().toISOString()}] Executing job ${job.id}...`);

    const scriptPath = path.join(__dirname, 'runner.sh');

    return new Promise((resolve, reject) => {
      exec(scriptPath, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.warn(`Script stderr: ${stderr}`);
        }
        console.log(`Script output:\n${stdout.trim()}`);
        resolve(stdout);
      });
    });
  },
  { connection }
);

// ----  worker callbacks for 'completed' and 'failed' 
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully :-) .`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});


// ---------- 3. Run setup  ---------------------------
setupCronJob();
