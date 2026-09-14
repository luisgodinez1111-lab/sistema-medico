import { and, eq } from 'drizzle-orm';
import {
  newTenantId,
  newOrganizationId,
  newFacilityId,
  newUserId,
  newMembershipId,
  newRoleId,
  newPractitionerId,
} from '@medical-os/shared';
import { ConflictError } from '@medical-os/shared';
import { createNeonDatabase } from './client';
import { createTenantContext } from './tenant-context';
import { hashPassword } from './auth-credentials';
import { BASE_PERMISSIONS } from './provisioning';
import { PatientRepository, type NewPatientInput } from './repositories/patient';
import { AllergyRepository } from './repositories/allergy';
import { ConditionRepository } from './repositories/condition';
import { ObservationRepository } from './repositories/observation';
import { RelatedPersonRepository } from './repositories/related-person';
import { SpecialtyRepository } from './repositories/specialty';
import {
  tenant,
  organization,
  facility,
  appUser,
  membership,
  role,
  permission,
  rolePermission,
  membershipRole,
  practitioner,
  patient,
} from './schema';

/**
 * Seed mínimo y DETERMINISTA del vertical slice (paso 1, §28):
 * tenant → organización → consultorio → usuario → membresía → rol admin → médico.
 *
 * Idempotente: se identifica por claves naturales (slug, email, key) y no
 * duplica si ya existe. NO contiene PHI real (§16, §33): sólo datos de demo.
 * Ejecutar con `pnpm --filter @medical-os/db db:seed` (con .env.local cargado).
 */

const DEMO = {
  tenantSlug: 'clinica-demo',
  tenantName: 'Clínica Demo',
  orgName: 'Consultorio de Medicina General',
  facilityName: 'Consultorio Centro',
  timezone: 'America/Mexico_City',
  userEmail: 'demo@medicalos.local',
  userName: 'Dr. Demo',
  roleKey: 'admin',
  roleName: 'Administrador clínico',
  specialty: 'Medicina general',
} as const;

// Permisos base: se reutiliza la ÚNICA fuente de verdad de provisioning para no
// derivar (antes había una copia local que se desincronizó). Al re-sembrar, todo
// permiso nuevo se backfillea al catálogo y al rol admin (idempotente).
const PERMISSIONS = BASE_PERMISSIONS;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL/DIRECT_DATABASE_URL no definidas; no se puede sembrar.');
  }
  const db = createNeonDatabase(url);

  // 1) Tenant (por slug)
  let [t] = await db.select().from(tenant).where(eq(tenant.slug, DEMO.tenantSlug)).limit(1);
  if (!t) {
    [t] = await db
      .insert(tenant)
      .values({ id: newTenantId(), name: DEMO.tenantName, slug: DEMO.tenantSlug })
      .returning();
  }
  const tenantId = t!.id;

  // 2) Organización (por nombre dentro del tenant)
  let [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.tenantId, tenantId))
    .limit(1);
  if (!org) {
    [org] = await db
      .insert(organization)
      .values({ id: newOrganizationId(), tenantId, name: DEMO.orgName })
      .returning();
  }
  const organizationId = org!.id;

  // 3) Consultorio / facility (idempotente; sólo se crea si falta)
  const [fac] = await db.select().from(facility).where(eq(facility.tenantId, tenantId)).limit(1);
  if (!fac) {
    await db.insert(facility).values({
      id: newFacilityId(),
      tenantId,
      organizationId,
      name: DEMO.facilityName,
      timezone: DEMO.timezone,
    });
  }

  // 4) Usuario global (por email) con contraseña para el login (NIVEL 2).
  // La contraseña demo se toma de entorno; el fallback es SOLO para desarrollo
  // local y nunca debe usarse en producción.
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'medicalos-demo-1234';
  const demoPasswordHash = await hashPassword(demoPassword);
  let [user] = await db.select().from(appUser).where(eq(appUser.email, DEMO.userEmail)).limit(1);
  if (!user) {
    [user] = await db
      .insert(appUser)
      .values({
        id: newUserId(),
        email: DEMO.userEmail,
        displayName: DEMO.userName,
        status: 'active',
        passwordHash: demoPasswordHash,
      })
      .returning();
  } else if (!user.passwordHash) {
    // Usuario preexistente sin contraseña: fijar la del seed (idempotente).
    await db.update(appUser).set({ passwordHash: demoPasswordHash }).where(eq(appUser.id, user.id));
  }
  const userId = user!.id;

  // 5) Membresía usuario ↔ tenant
  let [mem] = await db.select().from(membership).where(eq(membership.userId, userId)).limit(1);
  if (!mem) {
    [mem] = await db
      .insert(membership)
      .values({ id: newMembershipId(), tenantId, userId, status: 'active' })
      .returning();
  }
  const membershipId = mem!.id;

  // 6) Catálogo global de permisos (idempotente)
  for (const p of PERMISSIONS) {
    await db.insert(permission).values(p).onConflictDoNothing();
  }

  // 7) Rol admin tenant-scoped + todos los permisos
  let [adminRole] = await db.select().from(role).where(eq(role.tenantId, tenantId)).limit(1);
  if (!adminRole) {
    [adminRole] = await db
      .insert(role)
      .values({ id: newRoleId(), tenantId, key: DEMO.roleKey, name: DEMO.roleName })
      .returning();
  }
  const roleId = adminRole!.id;
  for (const p of PERMISSIONS) {
    await db
      .insert(rolePermission)
      .values({ tenantId, roleId, permissionKey: p.key })
      .onConflictDoNothing();
  }

  // 8) Asignar rol a la membresía
  await db.insert(membershipRole).values({ tenantId, membershipId, roleId }).onConflictDoNothing();

  // 9) Practitioner (médico) para el usuario demo
  const [existingPract] = await db
    .select()
    .from(practitioner)
    .where(eq(practitioner.userId, userId))
    .limit(1);
  if (!existingPract) {
    await db.insert(practitioner).values({
      id: newPractitionerId(),
      tenantId,
      userId,
      specialty: DEMO.specialty,
    });
  }

  // 9b) Especialidad activa del tenant (R7): medicina general (línea base).
  await new SpecialtyRepository(db, createTenantContext({ tenantId, userId })).setActivePack(
    'medicina-general',
  );

  // 10) Pacientes demo (NIVEL 3). Idempotente vía MRN único por tenant.
  const ctx = createTenantContext({ tenantId, userId });
  const patientRepo = new PatientRepository(db, ctx);
  const DEMO_PATIENTS: NewPatientInput[] = [
    {
      mrn: '000123',
      givenNames: 'María Fernanda',
      firstSurname: 'Ruiz',
      secondSurname: 'Delgado',
      birthDate: '1991-04-12',
      sex: 'female',
    },
    {
      mrn: '000456',
      givenNames: 'Santiago',
      firstSurname: 'Herrera',
      secondSurname: 'López',
      birthDate: '2026-03-01',
      sex: 'male',
    },
  ];
  for (const p of DEMO_PATIENTS) {
    try {
      await patientRepo.create(p);
    } catch (error) {
      // MRN ya existe: seed idempotente, nada que hacer.
      if (!(error instanceof ConflictError)) throw error;
    }
  }

  // 11) Alergias demo (NIVEL 3). Idempotente: solo si el paciente no tiene ya.
  const allergyRepo = new AllergyRepository(db, ctx);
  const [maria] = await db
    .select()
    .from(patient)
    .where(and(eq(patient.tenantId, tenantId), eq(patient.mrn, '000123')))
    .limit(1);
  if (maria && (await allergyRepo.listForPatient(maria.id)).length === 0) {
    await allergyRepo.create({
      patientId: maria.id,
      substance: 'Penicilina',
      category: 'medication',
      criticality: 'high',
      reaction: 'anafilaxia',
    });
  }
  // Santiago: sin alergias conocidas (NKDA explícito).
  const [santiago] = await db
    .select()
    .from(patient)
    .where(and(eq(patient.tenantId, tenantId), eq(patient.mrn, '000456')))
    .limit(1);
  if (santiago) await allergyRepo.markReviewed(santiago.id);

  // Santiago es pediátrico: registrar a su madre como contacto de emergencia.
  if (santiago) {
    const relatedRepo = new RelatedPersonRepository(db, ctx);
    if ((await relatedRepo.listForPatient(santiago.id)).length === 0) {
      await relatedRepo.create({
        patientId: santiago.id,
        name: 'Laura Herrera López',
        relationship: 'mother',
        phone: '55-1234-5678',
        isEmergencyContact: true,
      });
    }
  }

  // 12) Problemas activos demo (NIVEL 3) para María. Idempotente.
  const conditionRepo = new ConditionRepository(db, ctx);
  if (maria && (await conditionRepo.listAll(maria.id)).length === 0) {
    await conditionRepo.create({
      patientId: maria.id,
      code: 'Diabetes mellitus tipo 2',
      onsetDate: '2021-01-01',
    });
    await conditionRepo.create({
      patientId: maria.id,
      code: 'Hipertensión arterial',
      onsetDate: '2022-01-01',
    });
  }

  // 13) Signos vitales demo (NIVEL 3) para María. Idempotente.
  const observationRepo = new ObservationRepository(db, ctx);
  if (maria && (await observationRepo.listForPatient(maria.id)).length === 0) {
    await observationRepo.create({
      patientId: maria.id,
      code: 'blood-pressure',
      valueText: '138/86',
      unit: 'mmHg',
    });
    await observationRepo.create({
      patientId: maria.id,
      code: 'weight',
      valueText: '72',
      unit: 'kg',
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed OK · tenant=${DEMO.tenantSlug} org="${DEMO.orgName}" facility="${DEMO.facilityName}" user=${DEMO.userEmail} · pacientes=${DEMO_PATIENTS.length}`,
  );
}

main().catch((error: unknown) => {
  console.error('Fallo al sembrar:', error);
  process.exit(1);
});
