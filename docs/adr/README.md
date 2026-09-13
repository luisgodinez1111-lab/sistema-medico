# Architecture Decision Records (ADR)

Cada decisión estructural de Medical OS se registra como un ADR inmutable.
Una decisión posterior no edita un ADR previo: crea uno nuevo que lo *supersede*.

Formato: [MADR](https://adr.github.io/madr/) simplificado.

## Índice

| ADR                                        | Título                          | Estado    |
| ------------------------------------------ | ------------------------------- | --------- |
| [0001](0001-modular-monolith.md)           | Arquitectura modular monolith   | Aceptado  |
| [0002](0002-multi-tenancy.md)              | Estrategia multi-tenant         | Aceptado  |
| [0003](0003-phi-handling.md)               | Manejo de PHI                   | Aceptado  |
| [0004](0004-rls-deferral.md)               | Diferimiento de RLS             | Aceptado  |

## Estados posibles

`Propuesto` → `Aceptado` → `Deprecado` / `Superado por ADR-XXXX`
