# ADR-0000 — Registro de decisiones de arquitectura, y por qué la numeración empieza en 0011

Status: ACCEPTED (2026-10-06) — auditoría R09-004

> **Fecha:** 2026-10-06. **Escrito por:** el agente de remediación de la auditoría, por indicación del dueño del
> repositorio. **Decidido por:** este ADR no toma ninguna decisión de arquitectura: es un índice y una explicación. La
> única cosa que fija —cómo se numeran y qué debe contener un ADR de aquí en adelante— es una convención del repositorio,
> y si el dueño quiere otra, se cambia aquí.

## Contexto

La auditoría (R09-004) encontró que **ADR-0000 a ADR-0010 nunca se crearon**, pese a ser la primera recomendación de
gobierno, y que la numeración de este repositorio empieza en ADR-0011. Medido:
`ls docs/adr/ | grep -E 'ADR-00(0[0-9]|10)'` devolvía cero.

El hueco es real y no se puede tapar escribiendo once ADR retroactivos. **Un ADR documenta una decisión que alguien tomó**;
redactar hoy once decisiones fundacionales que nadie registró sería inventar un rastro de gobierno, que es exactamente el
defecto que esta misma auditoría persigue en otros sitios: la tabla de firmas humanas de capacidades C5 vacía (R09-020) y
`Mapping_Adjudication.csv` con cero filas de datos (R09-023). Rellenar el hueco con texto plausible lo haría **peor**: un
registro falso es más dañino que un registro ausente, porque el ausente se ve.

## Decisión

1. **El hueco se explica, no se rellena.** Este ADR-0000 ocupa el número cero para que quien abra `docs/adr/` encuentre
   primero la explicación y no un salto silencioso. Los números 0001–0010 **quedan deliberadamente sin usar** y no se
   reciclarán: reutilizarlos haría creer que la serie está completa.

2. **Dónde está el rastro de las decisiones fundacionales.** No se perdió, pero no vive en ADR. Está en:
   - `docs/SPEC_INDEX.md` — el índice de especificaciones y su jerarquía de autoridad.
   - Las tres especificaciones maestras V2 en `docs/` (Producto, Ingeniería y el *Agent-Execution Companion*).
   - Los propios ADR-0011 en adelante, que recogen las decisiones de arquitectura que sí se registraron.

   Quien busque «por qué este sistema es así» debe empezar por `SPEC_INDEX.md`, no por esta carpeta.

3. **Qué debe contener un ADR de aquí en adelante.** Lo que la auditoría echó en falta en 25 de ellos (R09-003):
   - **Fecha** de la decisión (no la del commit: son cosas distintas, y si solo se conoce la del commit se dice así).
   - **Decidido por** — la persona. Si no consta, se escribe «no consta», no un nombre probable.
   - **Alternativas consideradas**, y por qué se descartaron. Una decisión sin alternativas no es una decisión: es una
     descripción.
   - **Contexto** y **consecuencias**, incluidas las malas.

   Esto lo verifica `tests/v22/adr-governance.test.ts`: un ADR nuevo sin encabezado no entra.

4. **Los 25 ADR heredados llevan su encabezado derivado, con la ausencia declarada.** En el lote 33 de la remediación se
   les añadió un bloque con la fecha de **incorporación al repositorio** (derivada de git, verificable), «Decidido por: no
   consta» y la alternativa **que el propio texto rechaza** cuando el texto la nombra. No se inventó ninguna fecha de
   decisión ni ningún decisor. El resultado es que la ausencia ahora **se ve en el fichero** en lugar de estar enterrada en
   un anexo de auditoría.

## Consecuencias

- **Buena:** `docs/adr/` deja de empezar con un salto inexplicado, y cada ADR dice qué se sabe y qué no de su origen.
- **Buena:** la convención es verificable, así que el defecto no se reproduce en lo nuevo.
- **Mala, y es la que importa:** 25 decisiones de arquitectura de este sistema **siguen sin decisor registrado**. Este ADR
  no lo arregla: lo hace visible. Completarlo exige que el dueño diga quién decidió cada una, y mientras no lo haga, la
  trazabilidad de gobierno de este repositorio está incompleta y así se declara en el cruce de la auditoría (R09-003).
- **Mala:** la fecha de la decisión de los 25 heredados es **irrecuperable**. La de incorporación al repositorio es lo más
  cercano que existe y está etiquetada como lo que es.

## Lo que este ADR NO hace

No reconstruye las once decisiones fundacionales ausentes. Si alguna de ellas importa —y hay candidatas obvias: por qué
event sourcing, por qué Postgres como única autoridad transaccional, por qué multi-tenant con RLS forzada— **debe
escribirse como un ADR nuevo con su número propio**, fechado hoy y firmado por quien la confirme, no como un ADR-0003
retroactivo. Una decisión confirmada hoy es un registro honesto; la misma decisión fechada en el pasado es una
falsificación.
