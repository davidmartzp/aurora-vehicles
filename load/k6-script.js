import http from 'k6/http';
import { check } from 'k6';

// Config: target total events and duration (seconds)
const TARGET_EVENTS = 1000;
const RATE_PER_SEC = 15; // max requests per second accepted by the server
const DURATION_S = Math.ceil(TARGET_EVENTS / RATE_PER_SEC); // keep within the rate limit

export let options = {
  scenarios: {
    generate: {
      executor: 'constant-arrival-rate',
      rate: RATE_PER_SEC,
      timeUnit: '1s',
      duration: `${DURATION_S}s`,
      preAllocatedVUs: Math.min(200, RATE_PER_SEC),
      maxVUs: 500
    }
  }
};

export default function () {
  const payload = JSON.stringify({
    vehicleId: `VEH-${Math.floor(Math.random()*1000)}`,
    type: Math.random() < 0.05 ? 'Emergency' : 'Position',
    latitude: -4.7 + (Math.random()-0.5)*0.1,
    longitude: -74.0 + (Math.random()-0.5)*0.1,
    timestamp: new Date().toISOString(),
    eventId: crypto.randomUUID()
  });
  const headers = { 'Content-Type': 'application/json' };
  const res = http.post('http://localhost:3000/api/events', payload, { headers });
  check(res, { 'accepted': (r) => r.status === 202 });
}

// Note: RATE_PER_SEC * DURATION_S may slightly exceed TARGET_EVENTS due to rounding up. To hit exactly 1000 events,
// use the shared-iterations executor: executor: 'shared-iterations', iterations: TARGET_EVENTS, vus: 200, maxDuration: `${DURATION_S}s`.
// The constant-arrival-rate approach better simulates steady arrival rate.
