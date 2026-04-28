# Copilot instructions for this repository

Source files consulted: especificaciones-tecnicas-reto2.md (system design / architecture doc).

---

1) Build, test, and lint commands

- No package.json, build scripts, test runner, or linter configuration were found in this repository. It currently contains a technical specification (especificaciones-tecnicas-reto2.md) describing a Node.js/TypeScript event-driven system.
- If this repo is later populated as a Node project, check for package.json at the repo root and run the usual scripts from there (example placeholders only — do not assume they exist):
  - Install: npm install
  - Build: npm run build
  - Test (full): npm test
  - Single test: npm test -- <test-file-or-pattern>
  - Lint: npm run lint

(Only include real commands in this section when package.json, tsconfig, or equivalent files are present.)

---

2) High-level architecture (summary)

- Pattern: Event-driven backend for real-time vehicle telemetry and emergency detection.
- Ingest layer: Express.js HTTP server exposing POST /api/events. Rate limit: 15 req/s. Server example port: 3000.
- Queue & storage: Redis (RDB + AOF for durability) + Bull queue for job management.
  - Queue name(s) referenced in spec: "vehicle-events" (code samples) and "vehicle-events-queue" (diagram). Expect one of these names in code/config.
- Workers: Up to 10 concurrent worker instances processing jobs from Bull. Workers emit an internal event 'emergency.detected' when Emergency events are detected.
- Notification: Workers trigger downstream flows (email via Nodemailer/Gmail, logging, metrics/Prometheus).
- Load testing: k6 referenced as generator for load scenarios (1000 events in 30s).

Files of interest (from spec):
- especificaciones-tecnicas-reto2.md — architecture, config snippets, and code pseudocode.

---

3) Key conventions and project-specific patterns

- Endpoint and payload
  - POST /api/events
  - JSON payload example (required fields): vehicleId, type ("Emergency" | "Position"), latitude, longitude, timestamp, eventId
  - The ingestion layer logs an exact receivedAt timestamp (ISO string) and enqueues the job with that timestamp.

- Rate limiting
  - Global request limiter: 15 requests per second (windowMs: 1000, max: 15). Keep tests and scripts within this limit or use burst-aware load tests.

- Queue and job conventions
  - Priorities: Emergency => high priority (spec uses priority 10), Position => low priority (priority 1).
  - Options used for adding jobs (examples): removeOnComplete: true, removeOnFail: false
  - Backoff and retries: exponential backoff with max 3 retries (spec describes retry/backoff policy and dead-letter behavior).
  - Job payload interface (VehicleEvent) includes receivedAt added by the ingestion service.

- Worker behavior
  - Workers process up to 10 jobs concurrently (concurrency limit in queue.process(10, ...)).
  - When event.type === 'Emergency', worker emits 'emergency.detected' (EventEmitter) and triggers email/metrics/logging flows.
  - Workers call job.progress(100) and return a processed status object on success; throw on errors so Bull handles retries.

- Redis expectations
  - Redis persistence: RDB + AOF enabled in examples. Expect configuration keys like REDIS_HOST, REDIS_PORT.
  - Redis data shapes from spec: queue list (queue:vehicle-events:pending) and per-event hashes evento:{evento_id} with status pending|processing|completed.

- Logging and observability
  - Precise timestamps in logs (HH:MM:SS.ms) for ingested and processed events.
  - Suggested metrics: counters for events by type, P95 latency, failed job counts.

- Naming conventions
  - Queue: 'vehicle-events' (check code for exact name). If multiple references appear, prefer the name present in package/config files.
  - Event names: 'emergency.detected' used by workers to notify downstream listeners.

---

4) Environment variables referenced in the spec (search code/config for exact usage before trusting):
- REDIS_HOST (default: localhost)
- REDIS_PORT (default: 6379)
- Any SMTP/Gmail credentials expected by the email sender (not present in this repo)

---

5) What to check on first run (for Copilot sessions)
- Look for package.json, tsconfig.json, docker-compose.yml, or Kubernetes manifests to determine actual run commands and service wiring.
- If package.json exists, populate the Build/Test/Lint section with concrete npm scripts.
- Search repo for code that defines the Bull queue name, concurrency, and retry/backoff settings to ensure Copilot-generated edits use the canonical names/values.

---

6) Other AI assistant configs found
- None: no CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, CONVENTIONS.md, or similar files were found.

---

Notes for Copilot sessions
- Prefer using the spec (especificaciones-tecnicas-reto2.md) as the authoritative source for architecture-level decisions when code is missing or incomplete.
- When adding new files, align queue names, priority mappings, worker concurrency, and Redis keys with the values in this spec.

---

Document created from: especificaciones-tecnicas-reto2.md

If you want this file adjusted, or if you later add package.json/tests/CI configs, ask to update the Build/Test/Lint section with concrete commands.
