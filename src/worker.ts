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

// Throttle: máximo 15 eventos por segundo
const RATE_LIMIT_PER_SECOND = 15;
const MIN_INTERVAL_MS = 1000 / RATE_LIMIT_PER_SECOND; // ~66.67ms entre eventos

let lastProcessTime = 0;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastProcessTime;
  if (elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastProcessTime = Date.now();
}

// Procesamos 1 evento a la vez para respetar el rate limit de 15/s
eventQueue.process(1, async (job) => {
  const start = Date.now();
  const evento = job.data as VehicleEvent;
  const processedAt = new Date().toISOString();

  // Throttle: esperar el tiempo necesario para no exceder 15 eventos/segundo
  await throttle();

  console.log(`[WORKER-${job.id}] Procesando evento: ${evento.type} | Placa: ${evento.vehicle_plate} | Timestamp: ${processedAt}`);

  try {
    // Marcar el evento como "processing" en Redis para evitar reprocesarlo en caso de fallos
    const key = `evento:${evento.eventId}`;
    await redisClient.hset(key, { processingStatus: 'processing', processingAt: processedAt });

    // Simular procesamiento (ej: lógica de negocio, llamadas a APIs externas, etc.)
    if (evento.type === 'Emergency') {
      console.log(`[EMERGENCIA] Detectada emergencia | Placa: ${evento.vehicle_plate} | Coordenadas: ${evento.coordinates.latitude}, ${evento.coordinates.longitude} | Timestamp: ${processedAt}`);
      eventBus.emit('emergency.detected', { ...evento, detectedAt: processedAt });
    } else if (evento.type === 'Position') {
      console.log(`[POSICIÓN] Posición registrada | Placa: ${evento.vehicle_plate} | Coordenadas: ${evento.coordinates.latitude}, ${evento.coordinates.longitude}`);
    }

    const duration = (Date.now() - start) / 1000;
    processingLatency.observe({ type: evento.type }, duration);
    eventsProcessed.inc({ type: evento.type }, 1);

    await redisClient.hset(key, { processingStatus: 'completed', processedAt });
    await job.progress(100);
    return { status: 'processed', processedAt, type: evento.type };
  } catch (error) {
    console.error(`[ERROR-WORKER-${job.id}]`, error);
    eventsFailed.inc({ type: (job.data && job.data.type) || 'unknown' }, 1);
    // mark failed status
    try { await redisClient.hset(`evento:${job.data.eventId}`, { processingStatus: 'failed' }); } catch (e) { /* ignore */ }
    throw error;
  }
});
