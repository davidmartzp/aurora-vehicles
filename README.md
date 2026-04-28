Reto M2 - Esqueleto TypeScript

Este repositorio contiene un esqueleto TypeScript para el sistema descrito en especificaciones-tecnicas-reto2.md.

Estructura creada:
- src/server.ts  -> servidor Express para POST /api/events
- src/queue.ts   -> inicialización de Bull + Redis
- src/worker.ts  -> worker que procesa eventos
- src/email.ts   -> stub para envío de email
- src/types.ts   -> tipos compartidos

Comandos (tras instalar dependencias):
- npm run build
- npm start
- npm run dev  (arranca servidor en modo desarrollo con ts-node-dev)
- npm run worker:dev (arranca worker en desarrollo)

Rellena .env con las credenciales de Redis y SMTP según .env.example
