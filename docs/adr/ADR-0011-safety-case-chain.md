# ADR-0011 — Safety Case Chain

Status: ACCEPTED FOR ARCHITECTURE / NOT A RELEASE CERTIFICATION


> **Encabezado de gobierno añadido el 2026-10-06 (auditoría R09-003).** El ADR original no declaraba fecha, autor ni
> alternativas. Lo que sigue se DERIVA de evidencia verificable o se declara ausente; **nada se reconstruye de memoria**:
> inventar una fecha de decisión o un decisor sería fabricar un registro de gobierno, que es justo el defecto que esta
> auditoría persigue en otros sitios (la tabla de firmas C5 vacía, `Mapping_Adjudication.csv` con cero filas).
>
> · **Fecha de incorporación al repositorio:** 2026-09-15 (del historial de git, `--diff-filter=A`). **No es la fecha de la
>   decisión**, que no consta en ninguna parte.
> · **Decidido por:** **no consta.** El repositorio registra quién hizo el commit, no quién tomó la decisión, y son cosas
>   distintas. Lo llena el dueño del producto; hasta entonces este ADR documenta una decisión sin decisor registrado.
> · **Alternativas consideradas:** Un caso de seguridad narrativo sin cadena verificable — el texto exige la cadena peligro→control→invariante→prueba.

Decision:
Every clinically consequential capability must be traceable through:
Authority → Hazard → Control → Invariant → Implementation → Test → Execution Evidence → Release Gate.

Consequences:
- A passing test without authority is insufficient.
- An invariant without a test is insufficient.
- A hazard without a control blocks affected release scope.
- Missing execution evidence remains BLOCKED.
- No document freeze implies production safety certification.
