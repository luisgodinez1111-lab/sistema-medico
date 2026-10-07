# ADR-0270 — Barreras de seguridad de prescripción: seis estados, confirmación de lo no evaluado y anulación justificada
Status: ACEPTADO (2026-09-22) — decisiones de los lotes 1, 4, 8 y 9b de la remediación (C-03/C-04/C-14, U-15, U-19)


> **Decidido por:** la remediación de la auditoría del 19-sep-2026, bajo la autorización del dueño del repositorio. El
> lote que lo introdujo y su hash están en `docs/reviews/2026-09-20-remediacion-auditoria.md`, así que la decisión es
> **rastreable a un cambio concreto** — a diferencia de los 25 ADR heredados, cuyo decisor no consta en ninguna parte.
> **Alternativas consideradas:** las que el apartado «Decisión» descarta explícitamente más abajo.

## Contexto

La auditoría encontró que un fármaco fuera del catálogo omitía todas las barreras en silencio, que la verificación
previa y la escritura divergían, y que un bloqueo era una negación muda sin vía clínica de excepción.

## Decisión

1. **Un solo evaluador** (`packages/prescription-safety`) para el dry-run (`/prescription-check`) y para PRESCRIBE,
   RESUME y MODIFY. Cada barrera termina en uno de seis estados: `PASSED`, `CAUTION`, `BLOCKED`, `NOT_APPLICABLE`,
   `NOT_COVERED`, `NOT_EVALUATED`. **"No pude evaluar" nunca se presenta como seguro.**
2. **Confirmación expresa** (428 `SAFETY_ACK_REQUIRED`) cuando hay barreras no evaluadas o una alergia leve/cruzada:
   el médico confirma (`acknowledgeUnverified`) y justifica; ambas quedan en el evento.
3. **Bloqueos anulables vs. duros** (`decideOverride`): alergia, interacción, duplicidad, contraindicación y ajuste
   renal admiten anulación **nombrando cada barrera** y con justificación clínica (≥ 20 caracteres) que queda en el
   evento con la identidad del médico; techo diario, dosis pediátrica por peso y orden mal formada **no** se anulan:
   se corrige la orden. Nombrar una barrera que no bloquea se rechaza (no se registran anulaciones "por si acaso").
4. **Las barreras corren en el servidor** en cada transición que pone un fármaco en curso; la UI solo muestra el
   resultado (no existe un "segundo camino" que las esquive).
5. Los detalles de error expuestos al cliente son una **lista cerrada de claves no-PHI** (`EXPOSED_DETAILS` en
   `apps/web/lib/http-errors.ts`): identificadores de barrera, versiones, razones; nunca valores clínicos.

## Consecuencias

- Un bloqueo anulado consta en el evento, en la cadena de auditoría y en la receta impresa (transparencia).
- El contenido clínico de las barreras (interacciones, techos, reglas renales) requiere validación médica antes de uso
  asistencial; la arquitectura no lo sustituye.
- Ampliar la lista de barreras anulables es una decisión clínica que se toma aquí, no en la UI.
