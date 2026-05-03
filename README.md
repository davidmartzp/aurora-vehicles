# Reto M2 - Sistema de Alerta Temprana para Flota Vehicular

## Propósito del proyecto
Este repositorio implementa un sistema de alerta temprana para eventos vehiculares en tiempo real, con foco en la detección de emergencias y la entrega oportuna de notificaciones. El diseño sigue un patrón orientado a eventos y busca cumplir los requisitos de robustez, durabilidad y rendimiento establecidos en el reto.

## Alcance y requerimientos cumplidos
Se enfoca en atender los objetivos clave del reto:
- Procesar hasta 1000 eventos en 30 segundos.
- Respetar una tasa máxima de ingreso de 15 peticiones por segundo en la API.
- Mantener una plataforma con alta confiabilidad y sin pérdida de eventos.
- Priorizar los eventos de tipo Emergency frente a los de tipo Position.
- Detectar emergencias y disparar notificaciones laterales, incluyendo correo electrónico y métricas.

## Arquitectura general
El sistema está organizado en capas claramente diferenciadas:
- Capa de ingesta: un servidor HTTP que recibe eventos a través de POST en la ruta /api/events.
- Capa de almacenamiento y cola: Redis como motor de persistencia y Bull para gestionar la cola de eventos.
- Capa de procesamiento: workers que consumen la cola, realizan detección de emergencia y actualizan el estado de los eventos.
- Capa de notificación y observabilidad: flujo de correo electrónico para emergencias, logs detallados y métricas expuestas para monitoreo.

## Componentes principales
- `src/server.ts`: expone la API de ingesta, valida la entrada, aplica rate limiting y encola eventos.
- `src/queue.ts`: configura la conexión con Redis y la cola de Bull usada para procesamiento asíncrono.
- `src/worker.ts`: procesa los eventos, maneja reintentos, registra resultados y emite alertas cuando se detecta una emergencia.
- `src/email.ts`: componente de notificación que dispara alertas por correo cuando se detecta un evento de emergencia.
- `src/metrics.ts`: define métricas de monitoreo para eventos encolados, procesados, fallidos y latencia.
- `src/types.ts`: contiene los tipos compartidos de datos usados por API, cola y workers.

## Requerimientos Arquitecturalmente Significativos (ASRs)
El diseño se apoya en ASRs claros para guiar las decisiones de arquitectura y asegurar que el sistema cumple con los objetivos del módulo.

### Disponibilidad
- Redis proporciona almacenamiento duradero y rápido.
- Bull permite reintentos automáticos y backoff exponencial en caso de fallo.
- El servidor aplica rate limiting para evitar sobrecarga y mantener la estabilidad.
- El sistema puede recuperarse de fallos de procesamiento sin perder eventos.

### Desempeño
- La cola de eventos permite desacoplar la ingesta del procesamiento, optimizando la concurrencia.
- Se usa prioridad en la cola para tratar emergencias con preferencia frente a datos de posición.
- Se limita la concurrencia de workers a un máximo razonable para equilibrar throughput y uso de recursos.
- Las métricas incluyen observación de latencia para permitir ajustes de P95 y desempeño.

### Seguridad
- La API valida el esquema JSON de entrada y rechaza payloads inválidos.
- Las credenciales y la configuración sensible se gestionan a través de variables de entorno.
- El servicio evita exponer datos innecesarios y solo sirve métricas en un endpoint controlado.
- Se propone un modelo que protege la integridad de los datos almacenados en Redis.

### Interoperabilidad
- El sistema se comunica mediante JSON estándar en su API REST.
- La cola y Redis facilitan la integración con componentes externos y escalabilidad.
- El endpoint de métricas es compatible con herramientas de observabilidad como Prometheus.
- El diseño permite conectar fácilmente la detección de eventos con otros servicios empresariales.


## Entregables del reto
El repositorio contiene todo lo necesario para demostrar la solución propuesta:
- Documentación técnica con el patrón arquitectónico y los componentes.
- Configuración de cola y persistencia para asegurar durabilidad y rendimiento.
- Flujos de ingesta, procesamiento y notificación claramente separados.
- Observabilidad mediante métricas y logs para verificar el funcionamiento.


