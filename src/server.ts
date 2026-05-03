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

// Limitar a 15 requests por segundo para evitar sobrecarga
const limiter = rateLimit({ windowMs: 1000, max: 15, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

const ajv = new Ajv();
const schema = {
  type: 'object',
  properties: {
    vehicle_plate: { type: 'string' },
    type: { type: 'string', enum: ['Emergency', 'Position'] },
    coordinates: {
      type: 'object',
      properties: {
        latitude: { type: 'string' },
        longitude: { type: 'string' }
      },
      required: ['latitude', 'longitude']
    },
    status: { type: 'string' }
  },
  required: ['vehicle_plate', 'type', 'coordinates', 'status']
};
const validate = ajv.compile(schema);

// Endpoint para recibir eventos de vehículos
app.post('/api/events', async (req, res) => {
  const ok = validate(req.body);
  if (!ok) return res.status(400).json({ error: 'Invalid payload', details: validate.errors });

  const payload = req.body as VehicleEvent;
  const receivedAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const evento = { ...payload, eventId, timestamp, receivedAt } as VehicleEvent;

  try {
    // Persiste en Redis para visibilidad y posible reintento manual
    const key = `evento:${evento.eventId}`;
    await redisClient.hset(key, {
      vehicle_plate: evento.vehicle_plate,
      type: evento.type,
      latitude: evento.coordinates.latitude,
      longitude: evento.coordinates.longitude,
      status: evento.status,
      timestamp: evento.timestamp,
      eventId: evento.eventId,
      receivedAt,
      processingStatus: 'pending'
    });
    // Push a una lista para seguimiento de eventos pendientes
    await redisClient.rpush('queue:vehicle-events:pending', evento.eventId);

    // Agrega a Bull con prioridad (Emergency > Position)
    const priority = evento.type === 'Emergency' ? 10 : 1;
    await eventQueue.add(evento, { priority, attempts: 3, backoff: { type: 'exponential', delay: 500 }, removeOnComplete: true, removeOnFail: false });

    eventsEnqueued.inc({ type: evento.type }, 1);

    console.log(`[INGESTA] Evento recibido: ${evento.type} | Placa: ${evento.vehicle_plate} | Timestamp: ${receivedAt}`);
    return res.status(202).json({ status: 'queued', eventId: evento.eventId, queuedAt: receivedAt });
  } catch (err) {
    console.error('[ERROR-INGESTA]', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Endpoint para consultar log de eventos (desde Redis)
app.get('/api/events', async (req, res) => {
  try {
    const eventIds = await redisClient.lrange('queue:vehicle-events:pending', 0, -1);
    const events = [];
    for (const id of eventIds) {
      const data = await redisClient.hgetall(`evento:${id}`);
      if (Object.keys(data).length > 0) {
        events.push(data);
      }
    }
    return res.json({ count: events.length, events });
  } catch (err) {
    console.error('[ERROR-LOG]', err);
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
