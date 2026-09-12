# ADR-0001 — Arquitectura modular monolith

- **Estado:** Aceptado
- **Fecha:** 2026-09-12
- **Deciden:** Backend/Domain, DevOps/SRE, Chief Product
- **Referencias del plan:** §3, §4, §34

## Contexto

Medical OS abarca dominios muy distintos (clínico, identidad, operaciones, interoperabilidad,
IA). Un sistema de microservicios prematuro añade complejidad operativa (latencia de red,
consistencia distribuida, observabilidad fragmentada) sin beneficio real en la etapa inicial,
donde el equipo es pequeño y la prioridad es integridad clínica y velocidad de iteración.

## Decisión

Se adopta un **modular monolith** desplegado como una sola aplicación Next.js, con **fronteras
de dominio explícitas** materializadas como paquetes del monorepo (`packages/*`) y comunicación
entre dominios mediante **servicios/eventos**, nunca por acceso directo a las tablas de otro
dominio.

Regla estructural (§4): _ningún módulo puede consultar tablas de otro dominio directamente desde
la UI; toda operación pasa por servicios/repositorios con autorización y auditoría aplicadas en
un punto común._

Se extraerán servicios independientes **solo por necesidad demostrada** (escalado, aislamiento
de cómputo, equipo dedicado), y los `repositories` abstraen el storage para que esa extracción
no requiera reescribir el dominio.

## Consecuencias

**Positivas**

- Transacciones locales simples y fuertes garantías de consistencia clínica.
- Un solo pipeline de despliegue, observabilidad y seguridad.
- Fronteras verificables por lint de importaciones entre paquetes.

**Negativas / mitigaciones**

- Riesgo de acoplamiento accidental → se mitiga con reglas de dependencia entre paquetes y
  revisión por CODEOWNERS.
- Escalado por dominio limitado → aceptable en R0–R4; se reevalúa con métricas reales (§32).
