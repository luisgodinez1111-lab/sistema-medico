# ADR-0002 — Estrategia multi-tenant

- **Estado:** Aceptado
- **Fecha:** 2026-09-12
- **Deciden:** Backend/Domain, Security, Data
- **Referencias del plan:** §2 (NIVEL 2), §19, §25, §33

## Contexto

Medical OS es SaaS multi-tenant con PHI. El aislamiento entre tenants es un requisito de
seguridad de primera clase: una fuga cross-tenant es un incidente crítico. El plan (§33)
prohíbe explícitamente usar un `patient_id` secuencial como control de acceso y autorizar en
el frontend.

## Decisión

**Etapa inicial:** un **Postgres compartido** (Neon) con `tenant_id` en **todas** las tablas
tenant-scoped. El aislamiento se garantiza por **defensa en profundidad**:

1. **Contexto de tenant resuelto en el servidor** a partir del principal autenticado. Nunca se
   confía en un `tenant_id` enviado por el cliente (§NIVEL 2).
2. **Data layer tenant-aware:** todos los repositories aplican `tenant scoping` obligatorio; no
   existe query a tablas tenant-scoped sin `tenant_id`.
3. **Constraints de base de datos** que incluyen `tenant_id` en claves e índices de unicidad.
4. **Row Level Security (RLS)** de Postgres como control adicional donde sea viable — nunca como
   control único (§34).
5. **IDs internos no predecibles** (UUID/ULID), separados de identificadores externos (§NIVEL 3).
6. **Pruebas automáticas cross-tenant / IDOR / BOLA** que deben fallar siempre (§NIVEL 2 gate).

**Evolución:** clientes enterprise o requisitos especiales pueden migrar a esquema/proyecto
dedicado **sin reescribir el dominio**, porque los repositories abstraen el storage.

## Consecuencias

- Toda tabla tenant-scoped nace con `tenant_id NOT NULL` y su índice compuesto.
- El `authorization decision ID` se registra en auditoría de operaciones sensibles (§NIVEL 2).
- La puerta de salida de NIVEL 2 no se cruza hasta que las pruebas cross-tenant existan y fallen
  ante cualquier intento de acceso cruzado.
