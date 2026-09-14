# Respaldo y Recuperación — Medical OS (NIVEL 17)

- **Objetivo:** que la recuperación sea **demostrable**, no supuesta. Backups verificados,
  procedimiento de restauración ensayado y objetivos (RTO/RPO) explícitos (§NIVEL 17, §25).
- **Principio:** un backup no probado no es un backup. Los drills se documentan con fecha,
  duración real y resultado.

## Objetivos de recuperación

| Métrica | Objetivo (producción) | Fundamento |
| --- | --- | --- |
| **RPO** (pérdida máxima de datos) | ≤ 5 min | Neon PITR es continuo (WAL); la pérdida se limita al último instante replicado |
| **RTO** (tiempo máximo de recuperación) | ≤ 1 h (BD) · ≤ 2 h (servicio completo) | Restaurar un branch PITR es de minutos; el resto es validación y re-apuntado |

> Estos objetivos son de diseño y deben **confirmarse con un drill real** antes del go-live.

## Superficies de datos y su respaldo

| Dato | Dónde | Respaldo | Notas |
| --- | --- | --- | --- |
| PHI y expediente | Neon Postgres | **PITR continuo** de Neon (retención según plan) + branches | Cifrado en reposo gestionado por Neon |
| Documentos clínicos (PDF/imagen) | Cloudflare R2 (bucket privado) | Versionado de objetos / réplica (a configurar) | El hash SHA-256 del documento vive en la BD para verificar integridad |
| Secretos | Vercel env / gestor | Rotación documentada (incident-response) | Nunca en el repo (§16) |
| Migraciones | Git (`packages/db/drizzle`) | Historia de Git | Reconstruyen el esquema de forma determinista |

## Restauración de la base de datos (Neon PITR)

1. **Declarar incidente** y fijar el instante objetivo de restauración (timestamp UTC previo
   a la corrupción/pérdida). Registrar en el ticket.
2. En el panel de Neon, crear un **branch desde el punto en el tiempo** (Point-in-Time
   Restore) al instante objetivo. Esto NO destruye el estado actual (permite forense).
3. Obtener la connection string del branch restaurado.
4. **Validar el branch** antes de re-apuntar producción:
   - `pnpm exec tsx --env-file=<branch>.env packages/db/src/migrate.ts` no debe requerir
     migraciones nuevas (esquema consistente).
   - Verificaciones puntuales de datos (conteos por tenant, últimos encuentros firmados).
5. Re-apuntar `DATABASE_URL`/`DIRECT_DATABASE_URL` en Vercel al branch restaurado y
   **redeploy** (o promover el branch a primario según la política de Neon).
6. Ejecutar el **health check** (`/api/health` → 200) y el **smoke E2E** (NIVEL 16) contra
   producción antes de declarar recuperado.
7. Cerrar el incidente con RTO/RPO reales medidos.

## Drill de restauración (ensayo periódico)

Cadencia sugerida: **trimestral** y antes de cada go-live.

1. Crear un branch PITR a un instante arbitrario (p. ej. hace 1 h) — entorno de ensayo, nunca
   producción.
2. Levantar la app apuntando al branch; correr `pnpm --filter @medical-os/web test:e2e`.
3. Medir el **tiempo total** (inicio del drill → E2E en verde) = RTO observado.
4. Registrar el resultado en la bitácora de drills (fecha, RTO, RPO, incidencias).

> **Estado:** procedimiento definido; **falta ejecutar el primer drill real** y registrar
> los tiempos observados (bloqueante de go-live, NIVEL 17/18).

## Bitácora de drills

| Fecha | Tipo | RTO observado | RPO observado | Resultado | Notas |
| --- | --- | --- | --- | --- | --- |
| _(pendiente)_ | — | — | — | — | Primer drill previo a go-live |
