# ADR-0030 — Modular Monolith First, Service Extraction by Evidence
Status: ACCEPTED


> **Encabezado de gobierno añadido el 2026-10-06 (auditoría R09-003).** El ADR original no declaraba fecha, autor ni
> alternativas. Lo que sigue se DERIVA de evidencia verificable o se declara ausente; **nada se reconstruye de memoria**:
> inventar una fecha de decisión o un decisor sería fabricar un registro de gobierno, que es justo el defecto que esta
> auditoría persigue en otros sitios (la tabla de firmas C5 vacía, `Mapping_Adjudication.csv` con cero filas).
>
> · **Fecha de incorporación al repositorio:** 2026-09-15 (del historial de git, `--diff-filter=A`). **No es la fecha de la
>   decisión**, que no consta en ninguna parte.
> · **Decidido por:** **no consta.** El repositorio registra quién hizo el commit, no quién tomó la decisión, y son cosas
>   distintas. Lo llena el dueño del producto; hasta entonces este ADR documenta una decisión sin decisor registrado.
> · **Alternativas consideradas:** Microservicios como arquitectura de partida — el propio texto la rechaza («will not use microservices as a prestige architecture») y fija extracción por evidencia.

Medical OS will not use microservices as a prestige architecture. The clinical kernel begins as strongly bounded packages over one transactional Postgres authority. Services are extracted only when isolation, scaling, regulatory boundary, team ownership, or failure containment is demonstrated. This reduces distributed failure modes while preserving event/outbox seams for later extraction.
