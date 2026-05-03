import 'dotenv/config';
import { eventQueue, redisClient } from './queue';
import { VehicleEvent } from './types';
import { EventEmitter } from 'events';
import { sendAlertEmail } from './email';
import { eventsProcessed, eventsFailed, processingLatency } from './metrics';

// Event bus para manejar eventos internos del sistema
export const eventBus = new EventEmitter();
// Escuchar eventos de emergencia para enviar alertas por email
eventBus.on('emergency.detected', async (data) => {
  try {
    await sendAlertEmail('Emergencia detectada', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[EVENT-BUS] email error', e);
  }
});

// Sólo procesamos 10 eventos concurrentemente para evitar sobrecargar el sistema
eventQueue.process(10, async (job) => {
  const start = Date.now();
  const evento = job.data as VehicleEvent;
  const processedAt = new Date().toISOString();

  console.log(`[WORKER-${job.id}] Procesando evento: ${evento.type} | VehículoID: ${evento.vehicleId} | Timestamp: ${processedAt}`);

  try {
    // Marcar el evento como "processing" en Redis para evitar reprocesarlo en caso de fallos
    const key = `evento:${evento.eventId}`;
    await redisClient.hset(key, { status: 'processing', processingAt: processedAt });

    // Simular procesamiento (ej: lógica de negocio, llamadas a APIs externas, etc.)
    if (evento.type === 'Emergency') {
      console.log(`[EMERGENCIA] Detectada emergencia | VehículoID: ${evento.vehicleId} | Timestamp: ${processedAt}`);
      eventBus.emit('emergency.detected', { ...evento, detectedAt: processedAt });
    } else if (evento.type === 'Position') {
      console.log(`[POSICIÓN] Posición registrada | VehículoID: ${evento.vehicleId} | Ubicación: ${evento.latitude}, ${evento.longitude}`);
    }

    const duration = (Date.now() - start) / 1000;
    processingLatency.observe({ type: evento.type }, duration);
    eventsProcessed.inc({ type: evento.type }, 1);

    await redisClient.hset(key, { status: 'completed', processedAt });
    await job.progress(100);
    return { status: 'processed', processedAt, type: evento.type };
  } catch (error) {
    console.error(`[ERROR-WORKER-${job.id}]`, error);
    eventsFailed.inc({ type: (job.data && job.data.type) || 'unknown' }, 1);
    // mark failed status
    try { await redisClient.hset(`evento:${job.data.eventId}`, { status: 'failed' }); } catch (e) { /* ignore */ }
    throw error;
  }
});
