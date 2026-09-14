# Threat Model — Medical OS (NIVEL 15)

- **Método:** STRIDE por activo/dominio + defensa en profundidad (§25, NIST SP 800-207 Zero Trust).
- **Alcance:** aplicación web (Next.js/Vercel), BD (Neon Postgres), object storage (R2), IdP (Auth.js).
- **Activo crítico:** **PHI** (datos clínicos del paciente) y el **aislamiento entre tenants**.

## Modelo de confianza

Nada se confía por red o propiedad. Cada request: principal autenticado → contexto de
tenant server-side → política de autorización → repositorio tenant-scoped → constraint
BD → audit event. El cliente **nunca** es fuente de verdad de tenant ni de permisos.

## STRIDE por dominio

### Identidad / sesión (Auth.js, NIVEL 2)
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Spoofing | Fuerza bruta de contraseña | Rate-limit login (10/IP/5min); hash bcrypt; mensaje genérico | ✅ |
| Spoofing | Robo de sesión JWT | `AUTH_SECRET` en Vercel; cookies HttpOnly/SameSite de Auth.js; HSTS | ✅ |
| Elevation | Falta de MFA | **Pendiente:** MFA/WebAuthn para roles sensibles | ⬜ |
| Repudiation | Acción sin traza | `audit_event` con actor + decisión de autorización | ✅ |

### Multi-tenancy / autorización (ADR-0002)
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Info disclosure | IDOR/BOLA cross-tenant | Scoping obligatorio en repos; `tenant_id` en índices; pruebas cross-tenant que deben fallar | ✅ |
| Tampering | `tenant_id` enviado por cliente | Resuelto server-side desde el JWT; nunca del request | ✅ |
| Elevation | Falta ABAC/ReBAC + break-glass | **Pendiente:** policy engine completo, break-glass auditado | ⬜ |
| Defensa extra | Bug de scoping en app | RLS **diferida** (ADR-0004): red = pruebas cross-tenant + revisión | 🟨 |

### PHI en tránsito y reposo
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Info disclosure | Intercepción | TLS (Vercel/Neon/R2); HSTS + upgrade-insecure-requests | ✅ |
| Info disclosure | PHI en logs | Regla: sin PHI/CoT en logs; audit `payload` sin PHI en claro | ✅ |
| Info disclosure | PHI en URL/params | Prohibido; IDs internos ULID no predecibles | ✅ |
| Info disclosure | Exfiltración masiva (export) | Rate-limit FHIR export + búsqueda por usuario | ✅ |

### Documentos / object storage (R2, NIVEL 10)
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Info disclosure | URL pública de PHI | Bucket privado; solo URLs firmadas de 5 min; proxy autorizado | ✅ |
| Tampering | Alteración del archivo | Hash SHA-256 sellado en BD; original inmutable | ✅ |
| DoS | Presign masivo / archivos enormes | Rate-limit del presign; límite de tamaño (20 MB) y tipo | ✅ |
| Elevation | Malware en el archivo | **Pendiente:** pipeline antivirus/scan | ⬜ |

### Web / edge (Next.js, §25)
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Tampering | XSS | CSP (default-src self); React escaping; sin `dangerouslySetInnerHTML` | 🟨 (falta nonce; hoy `'unsafe-inline'`) |
| Tampering | Clickjacking | `frame-ancestors 'none'` + X-Frame-Options DENY | ✅ |
| Tampering | Inyección de `<base>` / form hijack | `base-uri 'self'`, `form-action 'self'` | ✅ |
| DoS | Endpoints de alto costo | Rate-limit auth/upload/search/export | ✅ (falta WAF) |

### Integridad clínica (§27, §33)
| Amenaza | Vector | Mitigación | Estado |
| --- | --- | --- | --- |
| Tampering | Editar nota firmada | Firma = snapshot + hash inmutable; solo addenda append-only | ✅ |
| Safety | Resultado crítico sin revisar | Result Inbox + owner + escalamiento en Command Center | ✅ |
| Safety | Contenido clínico no gobernado | Contenido DEMO versionado/marcado; promoción con reviewer | 🟨 |

## Brechas priorizadas (para cerrar NIVEL 15)

1. **MFA/WebAuthn** (identidad).
2. **CSP a nonce/hash** (quitar `'unsafe-inline'`).
3. **Rate-limit distribuido** (Upstash) + **WAF/bot control** (Vercel).
4. **Antivirus/scan** de documentos.
5. **ABAC/ReBAC + break-glass**; **SAST/DAST**; **pentest** previo a go-live.

> Este modelo se revisa cuando cambia un dominio o se añade una superficie (nuevo endpoint,
> integración externa, IA real). Ver `docs/security/incident-response.md`.
