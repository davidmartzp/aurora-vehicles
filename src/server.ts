import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import Ajv from 'ajv';
import { eventQueue, redisClient } from './queue';
import { VehicleEvent } from './types';
import metricsRegister, { eventsEnqueued } from './metrics';

const app = express();
app.use(bodyParser.json());

// Rate limiter: 15 req/s
const limiter = rateLimit({ windowMs: 1000, max: 15, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

const ajv = new Ajv();
const schema = {
  type: 'object',
  properties: {
    vehicleId: { type: 'string' },
    type: { type: 'string', enum: ['Emergency', 'Position'] },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    timestamp: { type: 'string' },
    eventId: { type: 'string' }
  },
  required: ['vehicleId', 'type', 'timestamp', 'eventId']
};
const validate = ajv.compile(schema);

app.post('/api/events', async (req, res) => {
  const ok = validate(req.body);
  if (!ok) return res.status(400).json({ error: 'Invalid payload', details: validate.errors });

  const payload = req.body as VehicleEvent;
  const receivedAt = new Date().toISOString();
  const evento = { ...payload, receivedAt } as VehicleEvent;

  try {
    // Persiste en Redis para visibilidad y posible reintento manual
    const key = `evento:${evento.eventId}`;
    await redisClient.hset(key, {
      vehicleId: evento.vehicleId,
      type: evento.type,
      latitude: String(evento.latitude || ''),
      longitude: String(evento.longitude || ''),
      timestamp: evento.timestamp,
      eventId: evento.eventId,
      receivedAt,
      status: 'pending'
    });
    // Push a una lista para seguimiento de eventos pendientes
    await redisClient.rpush('queue:vehicle-events:pending', evento.eventId);

    // Agrega a Bull con prioridad (Emergency > Position)
    const priority = evento.type === 'Emergency' ? 10 : 1;
    await eventQueue.add(evento, { priority, attempts: 3, backoff: { type: 'exponential', delay: 500 }, removeOnComplete: true, removeOnFail: false });

    eventsEnqueued.inc({ type: evento.type }, 1);

    console.log(`[INGESTA] Evento recibido: ${evento.type} | VehículoID: ${evento.vehicleId} | Timestamp: ${receivedAt}`);
    return res.status(202).json({ status: 'queued', eventId: evento.eventId, queuedAt: receivedAt });
  } catch (err) {
    console.error('[ERROR-INGESTA]', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Endpoint para métricas Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Servidor en puerto ${port}`));
