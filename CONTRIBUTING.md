# Cómo se contribuye a este repositorio

> Autoridad: auditoría 2026-09-19, anexo R09 (R09-032). Este documento no describe buenas intenciones: describe **lo que
> los gates ya imponen** y las reglas que la remediación aprendió a golpes. Si algo de aquí no está comprobado por un
> gate, se dice.

Esto es un sistema clínico. Un defecto no produce una mala experiencia: produce una decisión médica sobre datos
equivocados. Todo lo que sigue sale de ahí.

## 1. Los gates, que se ejecutan antes de cada commit

Ninguno es opcional y ninguno se "arregla" bajando el umbral.

| Comando | Qué impide |
| --- | --- |
| `pnpm typecheck` y `pnpm typecheck:web` | TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Nunca `any` sin justificación escrita al lado |
| `pnpm test` (vitest) | 1450 pruebas, incluidos los guardarraíles de estructura (god-module, rutas retiradas, contratos de diseño, superficie de autorización) |
| `pnpm traceability:check` | El registro formal de seguridad: peligros → controles → invariantes → pruebas |
| `pnpm release:check` | Admisión de release fail-closed |
| `pnpm capability:check` | Que ninguna capacidad regrese a fail-open |
| `pnpm openapi:registry` + `openapi:generate` + `openapi:check` | Que la OpenAPI describa las rutas que existen de verdad |
| `pnpm build:web` | Que compile lo que se despliega |
| `TEST_DATABASE_URL=… tsx scripts/ci/live-smoke.mts` | 107 pruebas **en vivo** contra Postgres real con RLS |

## 2. Reglas que no se negocian

1. **La evidencia se ejecuta o no es evidencia.** Un documento que afirma que algo funciona no cuenta. Si un control
   importa, tiene una prueba o una prueba en vivo; si no se puede ejecutar, se dice que no está verificado.
2. **Nada de umbrales, rangos ni fórmulas clínicas sin fuente primaria citada** (autor, publicación, año). Y al lado, lo
   que el algoritmo **no** hace: en qué población no aplica y qué no decide. Ver `docs/compliance/inventario-de-algoritmos.md`.
3. **Un dato que no se pudo calcular NO se presenta como normal.** Fail-closed: se dice qué falta. Un hueco que parece
   tranquilizador es peor que un error visible.
4. **Las migraciones aplicadas son inmutables** (D-07). Un error se corrige con otra migración hacia adelante. `pnpm
   db:migrate` es el único mecanismo que aplica SQL; `pnpm db:check` detecta deriva por sha256.
5. **Las pruebas en vivo corren contra una base DESECHABLE**, declarada en `TEST_DATABASE_URL`. Nunca contra la base de la
   aplicación: la cadena de auditoría es append-only y un tenant de prueba se queda para siempre.
6. **Variables de entorno nunca en el código** ni en un commit ni en un ticket. Ver `docs/runbooks/rotacion-de-secretos.md`.
7. **Comentarios en español cuando explican lógica de negocio**, y que expliquen **por qué**, no qué. El qué ya está en el
   código.
8. **Manejo de errores explícito.** Ningún `catch` vacío; ningún error que mapee a 2xx.
9. **Cambios quirúrgicos antes que reescrituras.** Si algo funciona y está mal estructurado, se pregunta antes de tocarlo.
10. **Antes de crear un fichero, verificar que no exista uno equivalente.** Este repositorio ya tuvo 102 paquetes
    duplicados; la mitad de la auditoría es exactamente eso.

## 3. Lo que la remediación aprendió (y ahora es un guardarraíl)

Cada una de estas reglas existe porque el defecto **ya ocurrió aquí**:

- **Lo escrito a mano deriva.** Una expectativa de hash copiada a mano dejó el drill de recuperación fallando un lote
  entero sin que nadie lo supiera. Todo valor esperado se **deriva** de la misma fuente que produce el real.
- **Un gate que nadie ejecuta no es un gate.** El drill de DR existía, el runbook lo declaraba criterio de aceptación y
  ningún comando lo corría. Si algo protege, entra en el smoke.
- **Una referencia que nadie resuelve es decorativa.** Siete controles decían estar verificados por etiquetas
  (`unit:test-result-closure`) que no correspondían a ningún fichero. Toda referencia resuelve a una ruta que existe.
- **Un paquete sin importadores da cobertura falsa.** Si sus tests pasan, parece cubierto y no corre. Se retira y se
  registra en `docs/adjudication/retired-paths.json` (el repo vive en iCloud y ya devolvió ocho paquetes borrados).
- **Medir antes de optimizar, y volver a medir.** Una reescritura mejoró 65× un caso y empeoró 10× el otro. El plan
  óptimo depende de cuántas filas se esperan.
- **Si un documento y el código discrepan, el documento miente.** Y si el documento es un ADR aceptado, se registra la
  enmienda diciendo dónde se cumple hoy lo que pedía.

## 4. Convención de commits

```
fix(auditoría <IDs>): qué defecto real se corrige
```
El cuerpo explica **el defecto**, no el cambio: qué podía pasar, cómo se midió y qué lo impide ahora. Termina con la
verificación ejecutada (gates, número de pruebas, pruebas en vivo).

Un hallazgo de auditoría se remedia en un **lote** con su fila en
`docs/reviews/2026-09-20-remediacion-auditoria.md` y su estado en
`docs/reviews/2026-09-23-cruce-anexos-auditoria.md`. Un hallazgo cerrado significa **cierre de ingeniería**: no implica
validación clínica ni determinación regulatoria, que son del dueño (ADR-0300).

## 5. Lo que este documento NO cubre

- **No hay proceso de revisión por pares** definido: hoy el dueño revisa. La revisión independiente es una de las
  condiciones pendientes de ADR-0300 (R09-015).
- **No hay política de ramas ni protección de `main`** configurada en la plataforma (P-13, decisión del dueño).
- **No hay guardia ni destinatario de alertas.** Ver `docs/runbooks/incidente-clinico-y-de-seguridad.md` §5.
