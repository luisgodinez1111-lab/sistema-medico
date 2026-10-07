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

## Alternativas consideradas

1. **Dejar el esquema sin claves foráneas y confiar en el kernel.** Era el estado de partida —cero FK en 47 tablas— y se
   descartó porque la enumeración de tenants, de la que depende el drenado del outbox, pasaba a ser un acto de confianza
   en lugar de una propiedad del esquema. Una FK no es un control de acceso, pero sí hace la enumeración **completa por
   construcción**.
2. **Claves foráneas con `ON DELETE CASCADE`.** Se descartó explícitamente: convertiría el `DELETE` de una fila
   administrativa en el borrado silencioso del expediente clínico entero de ese consultorio, que es lo último que debe
   poder ocurrir por accidente en un sistema con cinco años de retención legal.
3. **Validar el paciente con una clave foránea en vez de en el kernel.** Imposible por diseño: el paciente es un agregado
   del stream, no una fila relacional. De ahí `requireRegisteredPatient` — integridad referencial **por el kernel**.
4. **Poner la FK también en los registros de INTENTOS** (`phi_access_log`, `access_decisions`, `session_revocations`). Se
   descartó al medirlo: el acceso de un tenant no registrado —el que más interesa auditar— no se podría anotar. La
   integridad se habría comprado al precio de suprimir la auditoría del caso que importa.

## Consecuencias

- Hoy un token con un `tenantId` arbitrario crea un tenant "de facto" con su primer evento; RLS lo aísla, pero nada dice
  que ese tenant sea legítimo. La FK cierra esa puerta una vez decidido el aprovisionamiento.
- La migración será aditiva y con `NOT VALID` + validación posterior para no bloquear tenants existentes.
