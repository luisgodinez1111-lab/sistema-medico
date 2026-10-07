# ADR-0050 — Executable Application Foundation
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
> · **Alternativas consideradas:** Documentación de fundación sin aplicación ejecutable — el texto exige que la fundación sea ejecutable.

v5 establishes an actual web/application/worker/persistence seam rather than treating domain packages as the product.
The web shell must not bypass application services, authorization, tenant isolation, domain rules, or evidence gates.
Database RLS is defense-in-depth and never substitutes for application authorization.
