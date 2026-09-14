# Observabilidad y SLOs — Medical OS (NIVEL 17)

- **Objetivo:** saber que el sistema está sano **antes** que el usuario, con señales que NO
  filtran PHI (§17, §33). Cada señal tiene un dueño y una acción.
- **Principio:** medir lo que afecta la seguridad clínica y la disponibilidad, no vanidad.

## Health check

- **Endpoint:** `GET /api/health` (público, sin PHI). Comprueba conectividad con la BD.
  - `200 {status:"ok", db:"up", latencyMs, time}` — sano.
  - `503 {status:"degraded", db:"down", ...}` — la BD no responde.
- **Uso:** monitor externo de uptime (p. ej. cron/pinger) y health del deployment. `no-store`
  para no cachear un estado obsoleto.
- **Regla:** el endpoint NUNCA devuelve detalles internos (versiones, stack, conteos) — sólo
  el estado agregado.

## Señales a vigilar

| Señal | Fuente | Umbral / alerta | Dueño |
| --- | --- | --- | --- |
| Disponibilidad del sitio | Monitor sobre `/api/health` | 2 fallos consecutivos → alerta | On-call |
| Errores de runtime (5xx) | Vercel (runtime logs / observability) | pico sostenido → investigar | Ingeniería |
| Latencia p95 | Vercel Analytics | > objetivo por 10 min → investigar | Ingeniería |
| Conexiones/errores de BD | Panel de Neon | saturación de pool / picos de error | Ingeniería |
| Rate-limit disparado (429) | Logs de la app | picos anómalos → posible abuso (§15) | Security |
| Resultados críticos sin revisar | Command Center (§27) | > 0 y creciendo → riesgo clínico | Clinical safety |

## SLOs propuestos (a ratificar con datos)

- **Disponibilidad:** 99.5% mensual del flujo de login + expediente.
- **Latencia:** p95 < 800 ms en lectura del expediente.
- **Closed-loop clínico:** 0 resultados **críticos** sin revisar > 24 h (SAFER, §27).

## Disciplina de logs (§17, §33)

- **Prohibido** registrar PHI o identificadores de paciente en logs/telemetría. El lint
  restringe `console` (`no-console`, sólo `warn`/`error`).
- La trazabilidad de accesos a PHI va en `audit_event` (append-only, con actor y decisión de
  autorización), **no** en logs de aplicación.
- La provenance de IA registra engine/policy/contextHash, **nunca** el prompt ni PHI (§14).

## Pendiente NIVEL 17

- Ejecutar el primer **drill de restore** y registrar RTO/RPO reales
  (`docs/sre/backup-restore.md`).
- Conectar un monitor externo a `/api/health` con alerta.
- Definir dashboards y alertas concretas en Vercel + Neon.
- Versionado/réplica de objetos en R2 (respaldo de documentos).
