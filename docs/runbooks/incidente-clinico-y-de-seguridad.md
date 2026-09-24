# Runbook — Incidente clínico y de seguridad
> Autoridad: auditoría 2026-09-19, anexo R09 (R09-033). Gobierno operativo, no funcionalidad.
> Este runbook describe **qué hacer con lo que el sistema ya expone**; no promete capacidades que no existan, y donde
> falta una pieza lo dice y nombra a quién le toca.

## 0. Qué cuenta como incidente

| Clase | Ejemplos | Primer reflejo |
| --- | --- | --- |
| **Clínico** | Un resultado crítico sin resolver, una obligación vencida, una barrera de prescripción anulada sin justificación suficiente, un dato de un paciente mostrado en el expediente de otro | Contener el daño al paciente **antes** de investigar la causa |
| **Integridad del registro** | Hueco en la secuencia de eventos, cadena de auditoría que no encadena, evento escrito con payload inválido | No corregir datos: el registro es de solo-añadir. Se documenta y se anota encima |
| **Seguridad / PHI** | Sospecha de lectura entre tenants, credencial expuesta, sesión no revocada tras una baja | Revocar acceso primero, reconstruir después |
| **Disponibilidad** | La base no responde, el despliegue devuelve 5xx | El sistema falla cerrado por diseño: confirmar que **nadie vio un «guardado» falso** |

## 1. Contención (primeros 15 minutos)

1. **No borres nada.** El event store es append-only y la cadena de auditoría encadena por hash: borrar o editar una fila
   no oculta el problema, lo convierte en un problema de integridad además del original.
2. **Si es de seguridad, corta el acceso.** Revocar una sesión: `session_revocations` (migración 0023) se consulta en cada
   transacción con contexto de tenant, así que la revocación surte efecto en el siguiente comando, no en el siguiente
   despliegue.
3. **Si es clínico y afecta a un paciente concreto**, la conducta clínica va primero y la documenta el médico en el
   expediente. El sistema no sustituye esa decisión.
4. **Anota la hora y qué viste**, con el `requestId` si lo tienes: es lo que permite reconstruir después.

## 2. Diagnóstico con lo que el sistema ya da

| Pregunta | Dónde se responde |
| --- | --- |
| ¿Qué pasó en este expediente y en qué orden? | El stream del agregado en `clinical_events` (`tenant_id`, `aggregate_id`, `sequence`) |
| ¿Quién accedió a este expediente y con qué propósito? | `phi_access_log` (migración 0024): auditoría de LECTURAS, sin el contenido leído |
| ¿La cadena de auditoría está íntegra? | `pnpm audit:verify` recalcula las huellas; `scripts/v22/live-concurrency-and-audit-vector-proof.mts` la reproduce fuera de Postgres |
| ¿Hubo fuga entre tenants? | `scripts/v22/live-rls-every-table-proof.mts` recorre las tablas con RLS y lee con otro tenant bajo un rol sin BYPASSRLS |
| ¿El esquema coincide con el repositorio? | `pnpm db:check` (deriva por sha256, políticas, RLS forzada, migraciones pendientes) |
| ¿Se puede recuperar a un instante anterior? | Runbook de backup/DR §4 y el drill, que corre en cada gate |

## 3. Comunicación

- **Interna:** quien detecta escribe qué vio, cuándo y con qué evidencia. Sin conclusiones tempranas.
- **Al paciente o al responsable sanitario:** decisión del médico responsable, no del sistema ni de quien opera.
- **A la autoridad (notificación de brechas):** **PENDIENTE DE DECISIÓN DEL DUEÑO.** La LFPDPPP exige notificación de
  vulneraciones y el sistema no tiene ni el procedimiento ni el destinatario definidos. Anotado en R06-30 y en ADR-0280
  §Decisiones pendientes. Hasta que exista, este runbook **no** puede decir a quién se notifica.

## 4. Cierre

1. **Causa raíz por escrito**, no «se corrigió».
2. **Un gate nuevo o ninguno.** Si el incidente pudo pasar, algo no se estaba comprobando: el cierre es una prueba en vivo
   o un gate que falle ante ese escenario. Un incidente que se cierra solo con un mensaje de commit vuelve.
3. **Si el incidente reveló un hallazgo de auditoría**, entra en `docs/reviews/2026-09-20-remediacion-auditoria.md` con su
   lote, como cualquier otro.

## 5. Lo que este runbook NO cubre todavía

Se dice explícitamente para no dar una falsa sensación de cobertura:

- **Guardia y escalamiento:** no hay rotación de guardia ni destinatario de alertas definidos (decisión del dueño).
- **Notificación de brechas:** sin procedimiento formal (LFPDPPP; ver §3).
- **Acceso de emergencia (break-glass):** no está construido. Las tablas que lo modelaban se retiraron en la migración
  0028 y el paquete en el lote 10w. Si hace falta acceder a un expediente fuera del flujo normal, hoy **no hay** un camino
  auditado para hacerlo, y eso es una decisión pendiente, no un olvido.
