# Definition of Done (§31)

Un feature **no está terminado** hasta cumplir todo lo aplicable:

- [ ] PRD/issue define usuario, problema y resultado esperado.
- [ ] Threat impact y privacy impact revisados si maneja PHI o permisos.
- [ ] Autorización **server-side**; no depende de ocultar UI.
- [ ] Audit/provenance cuando corresponde.
- [ ] Estados `loading` / `empty` / `error` / `permission-denied` / `offline-retry`.
- [ ] Funciona en desktop, iPad y móvil según matriz de capacidades (§21).
- [ ] Unit tests de lógica e integration tests de límites relevantes.
- [ ] E2E si pertenece a un flujo crítico.
- [ ] No introduce log de PHI/secret.
- [ ] Cumple accessibility baseline (WCAG-oriented).
- [ ] Clinical content incluye fuente, versión y reviewer si aplica.
- [ ] Migraciones revisables y probadas en branch de Neon.
- [ ] Observabilidad mínima: metric/error/correlation cuando aplique.
- [ ] Documentación/ADR actualizada si cambia arquitectura.

## Decisiones prohibidas (§33) — bloquean el merge

1. Guardar la historia clínica como un JSON gigante o un único campo de texto.
2. Usar `patient_id` secuencial como único control de acceso.
3. Autorizar en el frontend.
4. Usar base de datos productiva para previews o desarrollo.
5. Guardar archivos clínicos sensibles en storage público.
6. Editar destructivamente una nota firmada.
7. Cron simple como única garantía de workflows clínicos sin idempotencia/ownership.
8. Alertas clínicas en JSX sin versión ni gobernanza.
9. Enviar el expediente completo a un proveedor de IA.
10. Prompts como sustituto de arquitectura clínica estructurada.
11. Mezclar pagos/inventario con tablas clínicas nucleares.
12. Migración destructiva productiva sin restore/rollback probado.
13. Prometer "100% seguro" o "invulnerable".
