# ADR-0290 — Integridad referencial en el event store: tabla `tenants`, paciente registrado y claves foráneas
Status: PROPUESTO (2026-09-22) — auditoría D-02. Parte implementada (verificación del paciente, lote 10d); la tabla de tenants y las FK exigen la decisión de aprovisionamiento.

## Contexto

La auditoría contó 0 claves foráneas en 47 `CREATE TABLE` y ninguna tabla `tenants`. En el modelo real (ADR-0240) las tablas
relacionales de dominio están muertas: la integridad que importa es (a) que todo evento pertenezca a un **tenant que exista**,
(b) que todo comando de creación apunte a un **paciente registrado del tenant** y (c) que las tablas del kernel
(`clinical_events`, `audit_chain_v3`, `command_idempotency`, `outbox`) compartan el mismo tenant.

## Decisión

1. **Paciente registrado (implementado, lote 10d):** `requireRegisteredPatient` en los 23 comandos de creación: 404 si el
   `patientId` no existe en el tenant, 409 si está fallecido. Es integridad referencial **por el kernel**, no por FK: el
   paciente es un agregado del stream, no una fila relacional.
2. **Tabla `tenants` (pendiente de decisión):** `tenants(id uuid pk, name, status ACTIVE|SUSPENDED, created_at)` y FK
   `clinical_events.tenant_id → tenants.id` (también auditoría, idempotencia y outbox). Requiere decidir el
   **aprovisionamiento**: (a) automático desde el IdP en el primer inicio de sesión (Auth0 Organizations: el claim
   `tenant_id` crea la fila) o (b) explícito por un administrador de plataforma (`POST /api/v1/tenants`, rol nuevo). La
   opción (a) es la que corresponde al modelo actual (el IdP es la fuente de identidad y tenant, ADR-0260); las pruebas en
   vivo aprovisionarían su tenant sintético en el prólogo.
3. **Claves foráneas entre tablas relacionales muertas: no.** Se retiran con D-09/ADR-0240 §4; añadirles FK sería
   documentar un modelo que no corre.
4. **Comprobación continua:** `pnpm db:check` añadirá, cuando exista `tenants`, la comprobación de eventos huérfanos
   (tenant inexistente) y de tablas del kernel sin la FK.

## Consecuencias

- Hoy un token con un `tenantId` arbitrario crea un tenant "de facto" con su primer evento; RLS lo aísla, pero nada dice
  que ese tenant sea legítimo. La FK cierra esa puerta una vez decidido el aprovisionamiento.
- La migración será aditiva y con `NOT VALID` + validación posterior para no bloquear tenants existentes.
