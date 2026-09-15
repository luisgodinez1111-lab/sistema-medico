# ADR-0060 — First Clinical Vertical Slice
Status: ACCEPTED

v6 prioritizes an end-to-end clinical path over horizontal scaffolding:
authenticated principal → application service → domain transition → optimistic persistence seam → event/outbox → worker/reconciliation → patient-state projection.
Mutation endpoints remain disabled until identity resolution and database wiring are actually present.
