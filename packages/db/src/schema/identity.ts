import { pgTable, pgEnum, text, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type {
  TenantId,
  OrganizationId,
  FacilityId,
  UserId,
  PractitionerId,
  MembershipId,
  RoleId,
} from '@medical-os/shared';

/**
 * NIVEL 2 — Identidad, tenancy y autorización (§NIVEL 2, §19.1, ADR-0002).
 *
 * Reglas materializadas en el esquema:
 * - Toda tabla tenant-scoped lleva `tenant_id NOT NULL` con índice compuesto.
 * - IDs internos = ULID (text), no secuenciales (§33).
 * - Estados como enums, no strings libres (§NIVEL 3).
 * - `app_user` es identidad GLOBAL; el vínculo con un tenant es `membership`.
 */

export const userStatus = pgEnum('user_status', ['active', 'invited', 'suspended', 'disabled']);
export const membershipStatus = pgEnum('membership_status', ['active', 'invited', 'revoked']);
export const facilityStatus = pgEnum('facility_status', ['active', 'inactive']);

/** Tenant: raíz de aislamiento. No tiene tenant_id: ES el tenant. */
export const tenant = pgTable('tenant', {
  id: text('id').primaryKey().$type<TenantId>(),
  name: text('name').notNull(),
  /** Slug estable para subdominios/rutas; único global. */
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey().$type<OrganizationId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('organization_tenant_idx').on(t.tenantId)],
);

export const facility = pgTable(
  'facility',
  {
    id: text('id').primaryKey().$type<FacilityId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    organizationId: text('organization_id').notNull().$type<OrganizationId>(),
    name: text('name').notNull(),
    /** Zona horaria IANA explícita por facility (§NIVEL 11, §33). */
    timezone: text('timezone').notNull().default('America/Mexico_City'),
    status: facilityStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('facility_tenant_idx').on(t.tenantId)],
);

/** Identidad global. La autenticación (MFA/passkeys) la gobierna el IdP (§3, §34). */
export const appUser = pgTable(
  'app_user',
  {
    id: text('id').primaryKey().$type<UserId>(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    /**
     * Hash de contraseña (bcrypt). NULL = usuario invitado que aún no la fijó.
     * NUNCA se guarda la contraseña en claro ni se expone este campo al cliente
     * (§NIVEL 2, §33). El login lo gobierna Auth.js (Credentials + JWT).
     */
    passwordHash: text('password_hash'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    /** Secreto TOTP (Base32) para MFA. NULL si no está enrolado (§NIVEL 2/15). */
    mfaSecret: text('mfa_secret'),
    status: userStatus('status').notNull().default('invited'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('app_user_email_idx').on(t.email)],
);

/**
 * Especialidad clínica activa del tenant (Release R7 — specialty packs). Una por
 * tenant (PK = tenant_id). `pack_id`/`pack_version` referencian el catálogo
 * versionado de `specialty-packs.ts` (contenido DEMO gobernado, §33 #8).
 */
export const tenantSpecialty = pgTable('tenant_specialty', {
  tenantId: text('tenant_id').primaryKey().$type<TenantId>(),
  packId: text('pack_id').notNull(),
  packVersion: text('pack_version').notNull(),
  activatedBy: text('activated_by').$type<UserId>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Vínculo usuario ↔ tenant. Aquí vive el tenant scoping de la identidad. */
export const membership = pgTable(
  'membership',
  {
    id: text('id').primaryKey().$type<MembershipId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    userId: text('user_id').notNull().$type<UserId>(),
    status: membershipStatus('status').notNull().default('invited'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('membership_tenant_user_idx').on(t.tenantId, t.userId),
    index('membership_user_idx').on(t.userId),
  ],
);

export const practitioner = pgTable(
  'practitioner',
  {
    id: text('id').primaryKey().$type<PractitionerId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    userId: text('user_id').notNull().$type<UserId>(),
    /** Cédula profesional (MX) u otro identificador de licencia. */
    licenseNumber: text('license_number'),
    specialty: text('specialty'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('practitioner_tenant_idx').on(t.tenantId),
    uniqueIndex('practitioner_tenant_user_idx').on(t.tenantId, t.userId),
  ],
);

/** Roles tenant-scoped (el mismo "key" puede existir en cada tenant). */
export const role = pgTable(
  'role',
  {
    id: text('id').primaryKey().$type<RoleId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('role_tenant_key_idx').on(t.tenantId, t.key)],
);

/** Catálogo GLOBAL de permisos (definiciones estables, no tenant-scoped). */
export const permission = pgTable('permission', {
  key: text('key').primaryKey(),
  description: text('description').notNull(),
});

export const rolePermission = pgTable(
  'role_permission',
  {
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    roleId: text('role_id').notNull().$type<RoleId>(),
    permissionKey: text('permission_key').notNull(),
  },
  (t) => [
    uniqueIndex('role_permission_idx').on(t.roleId, t.permissionKey),
    index('role_permission_tenant_idx').on(t.tenantId),
  ],
);

export const membershipRole = pgTable(
  'membership_role',
  {
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    membershipId: text('membership_id').notNull().$type<MembershipId>(),
    roleId: text('role_id').notNull().$type<RoleId>(),
  },
  (t) => [
    uniqueIndex('membership_role_idx').on(t.membershipId, t.roleId),
    index('membership_role_tenant_idx').on(t.tenantId),
  ],
);

/**
 * Relaciones para ReBAC (§NIVEL 2): p.ej. practitioner —caresFor→ patient.
 * subjectType/objectType permiten grafos de autorización tenant-scoped.
 */
export const relationship = pgTable(
  'relationship',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    relation: text('relation').notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('relationship_lookup_idx').on(t.tenantId, t.subjectType, t.subjectId, t.relation),
    index('relationship_object_idx').on(t.tenantId, t.objectType, t.objectId),
  ],
);
