import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const eventsEnqueued = new client.Counter({ name: 'events_enqueued_total', help: 'Total events enqueued', registers: [register], labelNames: ['type'] });
export const eventsProcessed = new client.Counter({ name: 'events_processed_total', help: 'Total events processed', registers: [register], labelNames: ['type'] });
export const eventsFailed = new client.Counter({ name: 'events_failed_total', help: 'Total events failed', registers: [register], labelNames: ['type'] });
export const processingLatency = new client.Histogram({ name: 'event_processing_seconds', help: 'Processing time seconds', registers: [register], labelNames: ['type'], buckets: [0.01,0.05,0.1,0.5,1,2,5] });

export default register;
