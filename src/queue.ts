import Queue from 'bull';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || 6379);

export const redisClient = new Redis({ host: redisHost, port: redisPort });
// Configuración de la cola de eventos con Bull
export const eventQueue = new Queue('vehicle-events', {
  redis: { host: redisHost, port: redisPort },
  settings: {
    stalledInterval: 5000,
    maxStalledCount: 3,
    // mantener el job en la cola por 1 segundo antes de reintentar, para evitar sobrecargar el sistema con reintentos inmediatos
    retryProcessDelay: 1000
  }
});

// Cola de Dead Letter para eventos que fallan repetidamente
export const dlqQueue = new Queue('vehicle-events-dlq', {
  redis: { host: redisHost, port: redisPort }
});

// Mover a DLQ después de 3 intentos fallidos
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
