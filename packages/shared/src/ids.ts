import { ulid } from 'ulid';

/**
 * Identificadores internos con "branding" de tipo.
 *
 * Regla del plan (§NIVEL 3, §33): usar IDs internos no predecibles (ULID) y
 * separarlos de identificadores externos. El branding impide, en tiempo de
 * compilación, pasar un `PatientId` donde se espera un `EncounterId`, un error
 * de clase que en salud puede significar "paciente equivocado" (§27).
 */

declare const brand: unique symbol;
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type Ulid = string;

// IDs de identidad / tenancy (§NIVEL 2)
export type TenantId = Branded<Ulid, 'TenantId'>;
export type OrganizationId = Branded<Ulid, 'OrganizationId'>;
export type FacilityId = Branded<Ulid, 'FacilityId'>;
export type UserId = Branded<Ulid, 'UserId'>;
export type PractitionerId = Branded<Ulid, 'PractitionerId'>;
export type MembershipId = Branded<Ulid, 'MembershipId'>;
export type RoleId = Branded<Ulid, 'RoleId'>;

// IDs clínicos (§NIVEL 3)
export type PatientId = Branded<Ulid, 'PatientId'>;
export type RelatedPersonId = Branded<Ulid, 'RelatedPersonId'>;
export type EncounterId = Branded<Ulid, 'EncounterId'>;
export type ConditionId = Branded<Ulid, 'ConditionId'>;
export type HistoryEntryId = Branded<Ulid, 'HistoryEntryId'>;
export type ObservationId = Branded<Ulid, 'ObservationId'>;
export type AllergyId = Branded<Ulid, 'AllergyId'>;
export type MedicationRequestId = Branded<Ulid, 'MedicationRequestId'>;
export type ProcedureId = Branded<Ulid, 'ProcedureId'>;
export type ServiceRequestId = Branded<Ulid, 'ServiceRequestId'>;
export type DiagnosticReportId = Branded<Ulid, 'DiagnosticReportId'>;
export type DocumentId = Branded<Ulid, 'DocumentId'>;
export type TaskId = Branded<Ulid, 'TaskId'>;
export type ConsentId = Branded<Ulid, 'ConsentId'>;

// Gobernanza (§NIVEL 3, §19)
export type AuditEventId = Branded<Ulid, 'AuditEventId'>;
export type ProvenanceId = Branded<Ulid, 'ProvenanceId'>;

/** Genera un nuevo ULID sin tipar. Preferir los helpers `new*Id()`. */
export function newUlid(): Ulid {
  return ulid();
}

/** Castea un string existente a un ID tipado (usar al leer de la BD). */
export function asId<T extends Ulid>(value: Ulid): T {
  return value as T;
}

export const newTenantId = (): TenantId => ulid() as TenantId;
export const newOrganizationId = (): OrganizationId => ulid() as OrganizationId;
export const newFacilityId = (): FacilityId => ulid() as FacilityId;
export const newUserId = (): UserId => ulid() as UserId;
export const newPractitionerId = (): PractitionerId => ulid() as PractitionerId;
export const newMembershipId = (): MembershipId => ulid() as MembershipId;
export const newRoleId = (): RoleId => ulid() as RoleId;
export const newPatientId = (): PatientId => ulid() as PatientId;
export const newRelatedPersonId = (): RelatedPersonId => ulid() as RelatedPersonId;
export const newEncounterId = (): EncounterId => ulid() as EncounterId;
export const newConditionId = (): ConditionId => ulid() as ConditionId;
export const newHistoryEntryId = (): HistoryEntryId => ulid() as HistoryEntryId;
export const newObservationId = (): ObservationId => ulid() as ObservationId;
export const newAllergyId = (): AllergyId => ulid() as AllergyId;
export const newMedicationRequestId = (): MedicationRequestId => ulid() as MedicationRequestId;
export const newProcedureId = (): ProcedureId => ulid() as ProcedureId;
export const newServiceRequestId = (): ServiceRequestId => ulid() as ServiceRequestId;
export const newDiagnosticReportId = (): DiagnosticReportId => ulid() as DiagnosticReportId;
export const newDocumentId = (): DocumentId => ulid() as DocumentId;
export const newTaskId = (): TaskId => ulid() as TaskId;
export const newConsentId = (): ConsentId => ulid() as ConsentId;
export const newAuditEventId = (): AuditEventId => ulid() as AuditEventId;
export const newProvenanceId = (): ProvenanceId => ulid() as ProvenanceId;
