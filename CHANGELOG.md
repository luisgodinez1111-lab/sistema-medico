# Registro de cambios

> Autoridad: auditoría 2026-09-19, anexo R09 (R09-032).

## Estado: sin versiones publicadas

**No existe ninguna versión liberada de este sistema.** No hay etiquetas de git, no hay número de versión en
`package.json` y la producción clínica sigue bloqueada: las condiciones de admisión y su estado están en
[`docs/adr/ADR-0300`](docs/adr/ADR-0300-condiciones-de-admision-a-produccion.md) —diez condiciones de ingeniería
cumplidas y comprobadas en cada commit, seis condiciones de decisión abiertas que son del dueño—.

Este fichero no inventa un historial de versiones que no ocurrió. Empieza aquí, y la primera entrada con número será la
primera liberación real.

## Dónde está el historial de cambios que SÍ existe

El repositorio lleva 479 commits y un registro de cambios detallado, pero no organizado por versiones sino por **lote de
remediación**, porque es lo que de verdad pasó:

| Registro | Qué contiene |
| --- | --- |
| [`docs/reviews/2026-09-20-remediacion-auditoria.md`](docs/reviews/2026-09-20-remediacion-auditoria.md) | Una fila por lote: el commit, los hallazgos que atiende y **qué defecto real se corrigió**, con las mediciones |
| [`docs/reviews/2026-09-23-cruce-anexos-auditoria.md`](docs/reviews/2026-09-23-cruce-anexos-auditoria.md) | Estado hallazgo por hallazgo (cerrado / parcial / abierto) y qué significa cada estado |
| [`docs/adjudication/retired-paths.json`](docs/adjudication/retired-paths.json) | Todo lo retirado, con el lote y el motivo |
| [`db/migrations/manifest.json`](db/migrations/manifest.json) | Las migraciones con su sha256; `pnpm db:check` detecta deriva |
| `git log` | La verdad, commit a commit |

Duplicar eso aquí en prosa crearía una segunda copia que se quedaría atrás —el defecto que esta auditoría persigue en
media docena de sitios—. Así que este fichero apunta, no transcribe.

## Cómo se mantiene a partir de la primera liberación

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) con versionado semántico, y dos reglas propias que
salen de la naturaleza clínica del sistema:

1. **Todo cambio que afecte a una regla clínica** (un umbral, un rango de referencia, una barrera de prescripción, una
   fórmula) se anota con su **fuente primaria** y se marca como `CLÍNICO`. Un cambio de umbral no es un detalle de
   implementación: cambia lo que el sistema le dice a un médico.
2. **Todo cambio que retire o relaje un control de seguridad** se anota como `SEGURIDAD` con el motivo y quién lo
   autorizó. Si no hay autorización escrita, no se hace.

### Secciones por versión

- `Añadido` · `Cambiado` · `Corregido` · `Retirado` · `Seguridad` · `Clínico`

## Sin liberar

Todo el trabajo actual. La remediación de la auditoría del 19-sep-2026 va por **120 de 181 hallazgos inventariados
cerrados**, y seis de los trece anexos aún no se han cruzado (R02b, R05b, R05c, R07, R08, R11). El detalle, en los dos
registros de revisión de arriba.
