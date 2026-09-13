# ADR-0004 — Diferimiento de Row Level Security (RLS)

- **Estado:** Aceptado
- **Fecha:** 2026-09-13
- **Deciden:** Backend/Domain, Security, Data
- **Referencias del plan:** §2 (NIVEL 2), §16, §25, §34
- **Relacionado:** complementa [ADR-0002](0002-multi-tenancy.md) (estrategia multi-tenant)

## Contexto

ADR-0002 lista RLS de Postgres como control **adicional** de aislamiento entre tenants,
"donde sea viable — nunca como control único". Al implementar la capa de datos se adoptó el
driver **`neon-http`** de `@neondatabase/serverless`:

- Es **stateless**: cada consulta es una petición HTTP independiente, sin sesión ni transacción
  persistente por request.
- RLS por tenant requiere fijar un parámetro de sesión (p. ej. `SET app.tenant_id = …` o `SET ROLE`)
  que la política `USING (tenant_id = current_setting(...))` lea **dentro de la misma sesión**.
- Con `neon-http` no hay una sesión estable donde ese `SET` sobreviva hasta el `SELECT`, así que
  una política RLS basada en GUC/rol por tenant **no es aplicable de forma fiable hoy**.

Forzar RLS con este driver daría una falsa sensación de seguridad (política presente pero no
efectiva) o exigiría un `SET` por cada consulta con garantías frágiles.

## Decisión

**Se DIFIERE RLS** de forma deliberada y documentada. El aislamiento entre tenants se sostiene
mientras tanto con la **defensa en profundidad** ya implementada y probada (ADR-0002):

1. **TenantContext resuelto en el servidor** desde el principal autenticado (IdP real, Auth.js);
   nunca se confía en un `tenant_id` del cliente.
2. **Repositories tenant-aware**: no existe consulta a tablas tenant-scoped sin `tenant_id`.
3. **Constraints e índices** que incluyen `tenant_id` en unicidad y claves.
4. **Pruebas automáticas cross-tenant / IDOR / BOLA** que deben fallar siempre (parte del gate).
5. **IDs no predecibles** (ULID) separados de identificadores externos.
6. **Auditoría** de decisiones de autorización y de accesos sensibles.

RLS queda como **control adicional pendiente**, no como control primario ausente: el control
primario es (2)+(3)+(4), aceptado por ADR-0002.

## Disparadores de revisión

Reabrir e implementar RLS cuando ocurra cualquiera de:

- Se adopte un driver/transporte con **sesión estable por request** (p. ej. el driver WebSocket/
  Pool de Neon, `postgres`/`pg` sobre conexión directa, o un pooler que preserve `SET LOCAL` dentro
  de una transacción por request).
- Se introduzca un **rol de base de datos por tenant** o un mecanismo equivalente de identidad a
  nivel de conexión.
- Un requisito de **cliente enterprise / cumplimiento** exija RLS como control mandatorio.
- Se migre un tenant a **esquema o proyecto dedicado** (evolución prevista en ADR-0002), donde el
  aislamiento a nivel de conexión es natural.

Al implementarlo: políticas `ENABLE ROW LEVEL SECURITY` + `USING (tenant_id = current_setting('app.tenant_id')::text)`
en todas las tablas tenant-scoped, fijando el GUC por transacción; las pruebas cross-tenant
existentes sirven de red de seguridad.

## Consecuencias

- **Positivas:** no se añade un control inefectivo ni complejidad frágil; el aislamiento real
  descansa en controles probados en cada release; la decisión queda trazable y con criterios
  objetivos de reapertura.
- **Negativas / riesgos:** no hay una última línea de defensa a nivel de motor si un bug de
  aplicación omitiera el scoping — mitigado por las pruebas cross-tenant obligatorias del gate y
  por la revisión de código de la capa de datos.
