import Queue from 'bull';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || 6379);

export const redisClient = new Redis({ host: redisHost, port: redisPort });

export const eventQueue = new Queue('vehicle-events', {
  redis: { host: redisHost, port: redisPort },
  settings: {
    stalledInterval: 5000,
    maxStalledCount: 3,
    // keep failed jobs for inspection
    retryProcessDelay: 1000
  }
});

export const dlqQueue = new Queue('vehicle-events-dlq', {
  redis: { host: redisHost, port: redisPort }
});

// Mueve jobs fallidos a DLQ
eventQueue.on('failed', async (job: any, err: Error) => {
  try {
    const attempts = (job.opts && job.opts.attempts) || 0;
    if (job.attemptsMade >= attempts) {
      console.error(`[DLQ] Moving job ${job.id} to DLQ after ${job.attemptsMade} attempts`);
      await dlqQueue.add(job.data, { removeOnComplete: false, removeOnFail: false });
    }
  } catch (e) {
    console.error('[DLQ] Error moving job to DLQ', e);
  }
});

export default eventQueue;
