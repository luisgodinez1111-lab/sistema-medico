# Revisión Senior — Documentos Maestros Medical OS V2 (15-sep-2026)

**Revisor:** Claude (Opus 4.8), en colaboración con el usuario.
**Alcance:** V2.0.1 (Product/Clinical), V2.1.1 (Engineering), Agent Execution Companion.
**Decisión ya tomada por el usuario:** _V2 es la autoridad; se empieza limpio desde L00_;
el repo actual pasa a **referencia/legado**.
**Bar:** senior, sin amateurismo, sin errores. Este informe es gobierno, no cambia código.

---

## 0. Veredicto

Los tres documentos son **excepcionalmente rigurosos y mutuamente coherentes** en lo
esencial: comparten namespace, invariantes clínicas, freeze gates y una jerarquía de
autoridad explícita. Es una base **construible a nivel senior**. No son amateurs.

Los problemas encontrados **no invalidan** la base; son de **reconciliación y de
infraestructura de gobierno faltante** que debe existir **antes** de la construcción masiva
(lo exigen los propios documentos: ENG-000/080/208/282, EXEC-0001/0048, PROD-175/NORM).

**Método/profundidad (honesto):** V2.0.1 leído íntegro; V2.1.1 leído en su núcleo +
arquitectura objetivo ENG-212…322 + mapa de las 348 secciones; Companion leído en su
gobierno (EXEC-0001…0006) + mapa de estructura (EXEC-0001…1652). La auditoría
línea-a-línea del Companion completo (~24.5k líneas) queda como pasada posterior.

---

## 1. Hallazgos por severidad

### S1 — Resolver antes de construir en masa

**S1-1 · Inconsistencia PRODUCT-GAP entre V2.0.1 y V2.1.1.**
V2.0.1 **promovió** los primitivos nuevos a autoridad de producto ACTIVE
(`PROD-116` Patient Computable State 2.0, `PROD-118` Intent, `PROD-119` Goal, `PROD-120`
Plan Compiler, `PROD-121` Expected Result, `PROD-122` Treatment Response, `PROD-124`
Hypothesis, `PROD-125` Missing Evidence, `PROD-126` Contradiction, `PROD-127` Uncertainty,
`PROD-129` Delta, `PROD-134` Attention Budget, `PROD-154` Patient OS, `PROD-156` Care Team),
y `PROD-177` los declara "Product authority: V2.0.1".
Sin embargo V2.1.1 **`ENG-281-R002` y la matriz `ENG-301`** siguen marcándolos `PRODUCT-GAP`
("absent from frozen V2"). Uno de los dos está **desactualizado**.
**Impacto:** ambigüedad de autoridad justo en las capacidades más nuevas y de mayor riesgo.
**Propuesta:** reconciliar en el **registro de trazabilidad** (S1-2), fijando estado por
capability (PROMOTED vs GAP) con evidencia; y anotar en V2.1.1 que la promoción PROD-114…177
cierra esos GAP. No implementar como "unrestricted" nada cuyo estado no quede resuelto.

**S1-2 · No existe el Registro de Trazabilidad (control anti-orphan).**
Los tres documentos lo **exigen** y lo describen (matriz `ENG-079`, formato JSON `ENG-080`,
extensión `ENG-208/282`, `EXEC-0048`, `PROD-NORM/PROD-FINAL`): un registro
**machine-readable y bidireccional** `PROD ↔ ENG ↔ EXEC ↔ code/test/evidence`. Hoy **no
existe** como artefacto. Es la pieza que impide que un requisito desaparezca o que se
implemente por "similitud semántica" (prohibido explícitamente, `PAI-007`).
**Impacto:** sin él, "empezar limpio" reincide en el mismo riesgo que los docs previenen.
**Propuesta:** es el **artefacto #1 de L00** — un `traceability/*.json` versionado + gate de
CI "no-orphan / no-unmapped-change".

**S1-3 · Falta (posible) 4.º documento.**
El usuario mencionó **4 documentos**; se entregaron **3 archivos**. El candidato natural es
precisamente el **registro de trazabilidad** o un **plan de fases** separado.
**Propuesta:** confirmar con el usuario. Si no existe, se genera como parte de L00 (S1-2).

**S1-4 · Reconciliación repo ↔ V2 (decidida: empezar limpio).**
El repo actual (`apps/web` + `packages/{db,shared,design-system}`, plan previo "18
niveles/R0–R7") cubre parte del golden slice (`ENG-070`) pero con estructura/granularidad
distintas al target (`ENG-004`/`EXEC-0004`: `clinical-domain`, `patient-state`,
`clinical-intelligence`, `clinical-content`, `medication`, `documents`, `diagnostics`,
`authz`, `audit`, `interoperability`, `security`, `observability`, `contracts`…).
**Propuesta:** ADR-0000 que registre (a) V2 como autoridad, (b) repo actual → legado, y
(c) **lista de "salvables"** para no tirar trabajo bueno (ver S3-8).

### S2 — Atender temprano (L00–L02)

**S2-5 · Doble numeración en V2.1.1.**
Coexisten IDs `ENG-xxx` y números de sección **bare** `1…348`; `PROD-177` referencia
"`§§302, 320, 338, 339`" que resuelven a secciones bare **dentro** del bloque constitución.
Los propios docs mandan referenciar **IDs estables**, no números de sección (`ENG-096`,
`PROD-NORM`). **Propuesta:** el registro de trazabilidad fija el ID canónico `ENG-xxx`;
prohibir referencias por número bare en artefactos nuevos.

**S2-6 · Escala del Companion (EXEC-0001…1652, ~24.5k líneas).**
`EXEC-0001` obliga a "cargar el mínimo contexto necesario", pero no hay índice
machine-readable de sus 1652 secciones. **Propuesta:** generar un `spec-index.json`
(EXEC + ENG + PROD: id → título → offset/anchor) para que los agentes carguen contexto
puntual sin leer 24k líneas. (Complementa `docs/SPEC_INDEX.md`, que es humano.)

**S2-7 · Validación de boundary (zod/equivalente).**
`ENG-099-R001` exige schema en **todo** boundary externo; `ENG-135` pide un kernel
semántico con IDs branded; `ENG-283` pide `packages/contracts`. El repo actual valida
`FormData` **a mano** y removió zod de `@medical-os/db` (`packages/shared` aún tiene zod v3
sin uso sistemático). **Propuesta:** en el arranque limpio, `packages/contracts` + schemas
de runtime en cada boundary desde el día 1 (no "a mano").

### S3 — Mejoras (aportes para fortalecer, no bloqueantes)

**S3-8 · "Lista de salvables" del repo actual (evitar tirar trabajo válido).**
Al empezar limpio, portar como referencia/reutilización evaluada: patrón **tenant-scoped
repo + TenantContext**, **soft-delete/append-only/provenance**, **firma = snapshot+hash**,
**R2 SigV4 sin SDK**, **TOTP + WebAuthn** (identidad), **CSP nonce en proxy**, **rate-limit
env-gated**, **health check**, **harness E2E Playwright**, **pipeline Neon-branch-por-PR**.
Todo esto ya está probado y alineado con V2.1 (`ENG-008/010/011/020/042/070/104…`); sería
amateur redescubrirlo. Debe entrar como decisión explícita en ADR-0000, no por inercia.

**S3-9 · Política de versión FHIR (interno vs boundary) temprano.**
`ENG-039/108/316` y `PROD-052/167` son consistentes (R5 publicado; adapters negocian
R4/R4B/R5; FHIR es boundary, no ontología interna), pero toca muchos primitivos.
**Propuesta:** fijarlo en **ADR-0018** desde L00 aunque la implementación llegue después.

**S3-10 · Hacer ejecutable el registro de invariantes.**
`ENG-309` (Clinical Invariant Registry) y `ENG-282` (orphan invariant = release blocker):
nacer con el registro de invariantes como archivo + tests-oráculo enlazados, no como prosa.

---

## 2. Secuencia de arranque recomendada (L00 → primeros contratos)

Alineado con `ENG-067` (L00 governance) y `EXEC-0001/0048`:

1. **ADR-0000** — V2 como autoridad; repo actual → legado; **lista de salvables** (S3-8);
   decisión "empezar limpio".
2. **Registro de Trazabilidad** `traceability/*.json` (`ENG-080`) + **gate CI no-orphan**
   (S1-2). Resolver ahí el estado PRODUCT-GAP (S1-1).
3. **`spec-index.json`** machine-readable de PROD/ENG/EXEC (S2-6).
4. **`packages/contracts`** (`ENG-283`): kernel semántico, information states
   (`UNKNOWN/NOT_ASSESSED/PENDING/CONFLICTING/UNVERIFIED/NOT_APPLICABLE…`), IDs branded,
   quantities/unit-safety, provenance — con **schemas de runtime** (S2-7).
5. **ADRs fundacionales** (`ENG-061`): 0001 boundaries, 0002 tenancy/RLS, 0003 PHI-logging,
   0004 immutable snapshot, 0006 authz policy, 0011 IDs/folios.
6. **Registro de invariantes** (`ENG-309`) + oráculos de test (S3-10).
7. Recién entonces: golden vertical slice (`ENG-070`) sobre la nueva estructura.

---

## 3. Preguntas abiertas para el usuario

1. **¿Existe el 4.º documento** (registro de trazabilidad o plan de fases), o el Companion
   cumple ese rol y lo generamos nosotros como L00?
2. **¿Nombre/orgID definitivos** del sistema y del monorepo objetivo? (El repo actual se
   llama `sistema-medico`; el target de los docs es `medical-os/`.)
3. **¿Empezar L00 ahora** (ADR-0000 + trazabilidad + contracts) o primero cerrar dudas de
   los docs?

> Conclusión: los documentos aguantan el estándar senior. El trabajo correcto **no** es
> más prosa: es construir el **andamiaje de gobierno ejecutable** (trazabilidad, contratos,
> invariantes) que los tres documentos exigen, y desde ahí el golden slice — reutilizando
> con criterio lo bueno del repo actual, sin arrastrar su estructura.
