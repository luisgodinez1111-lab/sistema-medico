# Plan de Respuesta a Incidentes — Medical OS (NIVEL 15)

- **Objetivo:** detectar rápido, contener el blast radius, preservar evidencia, recuperar
  de forma demostrable y cumplir la notificación legal (§25, LFPDPPP, ISO 27799:2025).
- **Principio:** no se promete invulnerabilidad; se prepara la respuesta.

## Niveles de severidad

| Sev | Definición | Ejemplos | Respuesta |
| --- | --- | --- | --- |
| **SEV1** | Brecha o exposición de PHI; acceso cross-tenant real; pérdida de integridad clínica | Fuga de datos de paciente; nota firmada alterada; credenciales comprometidas con acceso a PHI | Inmediata, 24/7, escalamiento total |
| **SEV2** | Riesgo de seguridad sin exposición confirmada; caída de un flujo clínico crítico | RCE potencial parchado; login/expediente caído; rate-limit evadido | Horas; on-call |
| **SEV3** | Vulnerabilidad sin explotación; degradación menor | Dependencia vulnerable; endpoint lento | Siguiente ciclo |

## Roles (aunque hoy sea un equipo pequeño, cada función tiene owner)

- **Incident Commander (IC):** coordina, decide, comunica. 
- **Security lead:** contención técnica, análisis forense.
- **Clinical safety:** evalúa impacto en pacientes y seguridad clínica.
- **Privacy/Compliance:** evalúa deber de notificación (LFPDPPP), titulares afectados.
- **Comms:** comunicación interna/externa aprobada por IC.

## Flujo de respuesta (SEV1/SEV2)

1. **Detectar y declarar.** Cualquiera puede declarar incidente. Registrar hora, fuente, hipótesis.
2. **Contener.** Aislar: revocar sesiones/tokens comprometidos, rotar secretos (`AUTH_SECRET`,
   credenciales R2/Neon/Upstash), bloquear IPs, pausar el endpoint/deploy afectado
   (Vercel: promover un deploy previo sano / `Pause`).
3. **Preservar evidencia.** NO borrar logs ni `audit_event`/`provenance` (append-only). Exportar
   audit trail relevante. Snapshot de Neon (branch) para forense sin tocar producción.
4. **Erradicar.** Corregir la causa raíz (patch, config, regla). Verificar con pruebas.
5. **Recuperar.** Restaurar desde Neon **PITR** si hubo corrupción/borrado; validar integridad
   (hashes de documentos, notas firmadas). Confirmar con smoke tests de flujos críticos.
6. **Cerrar y aprender.** Post-mortem sin culpa: línea de tiempo, causa raíz, acciones, dueños,
   fechas. Actualizar threat model y controles.

## Deber de notificación (privacidad, México)

Ante **vulneración de datos personales** (LFPDPPP): Privacy/Compliance evalúa alcance
(titulares y datos afectados) y **notifica a los titulares afectados sin demora** cuando
afecte significativamente sus derechos, con: naturaleza del incidente, datos comprometidos,
recomendaciones y medidas tomadas. Conservar evidencia del análisis y de la atención.
*(La implementación jurídica exacta se valida con asesoría especializada.)*

## Rotación de secretos (procedimiento)

- **AUTH_SECRET:** generar nuevo, actualizar en Vercel (prod/preview/dev), redeploy. Invalida
  sesiones existentes (efecto deseado en compromiso).
- **R2 (STORAGE_S3_*):** crear nuevo token en Cloudflare, actualizar env, redeploy, revocar el viejo.
- **Neon (DATABASE_URL):** rotar credencial en Neon, actualizar env, redeploy.
- **Upstash:** rotar token REST, actualizar env, redeploy.

## Contactos y recursos

- **Vercel:** deployment protection, promover/pausar deploy, audit logs.
- **Neon:** PITR/restore, branching para forense.
- **Cloudflare R2:** revocar tokens, revisar accesos.

## Pendiente para robustecer (NIVEL 15/17)

- Alertas automáticas (SIEM/telemetría) que **detonen** este plan, no solo revisión manual.
- Runbooks específicos por escenario (fuga R2, brute-force, cross-tenant).
- Drills de restore (RTO/RPO) — ver NIVEL 17.
