/**
 * Exportador FHIR R4 (Release R5). Mapea el dominio interno a recursos FHIR
 * para interoperabilidad (§NIVEL/R5). Es un mapeo de SALIDA (read-only); no
 * cambia el modelo interno. Los tipos se mantienen laxos (objetos JSON) a
 * propósito: el contrato es el JSON FHIR, no tipos TS estrictos de FHIR.
 */

export const FHIR_VERSION = '4.0.1';

export type FhirResource = Record<string, unknown>;

const ref = (patientId: string) => ({ reference: `Patient/${patientId}` });

export function toFhirPatient(p: {
  id: string;
  mrn: string;
  curp: string | null;
  givenNames: string;
  firstSurname: string;
  secondSurname: string | null;
  sex: string;
  birthDate: string;
}): FhirResource {
  const identifier: FhirResource[] = [{ system: 'urn:mos:mrn', value: p.mrn }];
  if (p.curp) identifier.push({ system: 'urn:mx:curp', value: p.curp });
  const family = [p.firstSurname, p.secondSurname].filter(Boolean).join(' ');
  return {
    resourceType: 'Patient',
    id: p.id,
    identifier,
    name: [{ family, given: p.givenNames.split(/\s+/).filter(Boolean) }],
    gender: ['female', 'male', 'other'].includes(p.sex) ? p.sex : 'unknown',
    birthDate: p.birthDate,
  };
}

export function toFhirAllergy(a: {
  id: string;
  patientId: string;
  substance: string;
  criticality: string;
  clinicalStatus: string;
  reaction: string | null;
}): FhirResource {
  return {
    resourceType: 'AllergyIntolerance',
    id: a.id,
    clinicalStatus: { coding: [{ code: a.clinicalStatus }] },
    criticality: a.criticality,
    code: { text: a.substance },
    patient: ref(a.patientId),
    ...(a.reaction ? { reaction: [{ manifestation: [{ text: a.reaction }] }] } : {}),
  };
}

export function toFhirCondition(c: {
  id: string;
  patientId: string;
  code: string;
  clinicalStatus: string;
  onsetDate: string | null;
}): FhirResource {
  return {
    resourceType: 'Condition',
    id: c.id,
    clinicalStatus: { coding: [{ code: c.clinicalStatus }] },
    code: { text: c.code },
    subject: ref(c.patientId),
    ...(c.onsetDate ? { onsetDateTime: c.onsetDate } : {}),
  };
}

export function toFhirObservation(o: {
  id: string;
  patientId: string;
  code: string;
  valueText: string;
  unit: string | null;
  category: string;
  effectiveAt: Date | string;
}): FhirResource {
  const effective = o.effectiveAt instanceof Date ? o.effectiveAt.toISOString() : o.effectiveAt;
  return {
    resourceType: 'Observation',
    id: o.id,
    status: 'final',
    category: [{ coding: [{ code: o.category }] }],
    code: { text: o.code },
    subject: ref(o.patientId),
    effectiveDateTime: effective,
    valueString: o.unit ? `${o.valueText} ${o.unit}` : o.valueText,
  };
}

export function toFhirMedicationRequest(m: {
  id: string;
  patientId: string;
  drug: string;
  dose: string | null;
  route: string;
  frequency: string | null;
  status: string;
}): FhirResource {
  const sig = [m.dose, m.route, m.frequency].filter(Boolean).join(' · ');
  return {
    resourceType: 'MedicationRequest',
    id: m.id,
    status: m.status,
    intent: 'order',
    medicationCodeableConcept: { text: m.drug },
    subject: ref(m.patientId),
    ...(sig ? { dosageInstruction: [{ text: sig }] } : {}),
  };
}

const ENCOUNTER_STATUS: Record<string, string> = {
  'in-progress': 'in-progress',
  signed: 'finished',
  amended: 'finished',
  cancelled: 'cancelled',
};

export function toFhirEncounter(e: {
  id: string;
  patientId: string;
  status: string;
  startedAt: Date | string;
  signedAt: Date | string | null;
  reason: string | null;
}): FhirResource {
  const start = e.startedAt instanceof Date ? e.startedAt.toISOString() : e.startedAt;
  const end = e.signedAt instanceof Date ? e.signedAt.toISOString() : e.signedAt;
  return {
    resourceType: 'Encounter',
    id: e.id,
    status: ENCOUNTER_STATUS[e.status] ?? 'unknown',
    class: { code: 'AMB', display: 'ambulatory' },
    subject: ref(e.patientId),
    period: { start, ...(end ? { end } : {}) },
    ...(e.reason ? { reasonCode: [{ text: e.reason }] } : {}),
  };
}

export function toFhirServiceRequest(s: {
  id: string;
  patientId: string;
  code: string;
  status: string;
}): FhirResource {
  return {
    resourceType: 'ServiceRequest',
    id: s.id,
    status: s.status,
    intent: 'order',
    code: { text: s.code },
    subject: ref(s.patientId),
  };
}

export function toFhirDiagnosticReport(r: {
  id: string;
  patientId: string;
  code: string;
  value: string;
  status: string;
}): FhirResource {
  return {
    resourceType: 'DiagnosticReport',
    id: r.id,
    status: r.status,
    code: { text: r.code },
    subject: ref(r.patientId),
    conclusion: r.value,
  };
}

/**
 * Construye un Bundle FHIR (type 'collection') con el expediente del paciente.
 * Recibe los datos ya cargados (y scoped) por la capa de aplicación.
 */
export function buildPatientBundle(data: {
  patient: Parameters<typeof toFhirPatient>[0];
  allergies: Parameters<typeof toFhirAllergy>[0][];
  conditions: Parameters<typeof toFhirCondition>[0][];
  observations: Parameters<typeof toFhirObservation>[0][];
  medications: Parameters<typeof toFhirMedicationRequest>[0][];
  encounters: Parameters<typeof toFhirEncounter>[0][];
  orders: Parameters<typeof toFhirServiceRequest>[0][];
  reports: Parameters<typeof toFhirDiagnosticReport>[0][];
}): FhirResource {
  const resources: FhirResource[] = [
    toFhirPatient(data.patient),
    ...data.allergies.map(toFhirAllergy),
    ...data.conditions.map(toFhirCondition),
    ...data.observations.map(toFhirObservation),
    ...data.medications.map(toFhirMedicationRequest),
    ...data.encounters.map(toFhirEncounter),
    ...data.orders.map(toFhirServiceRequest),
    ...data.reports.map(toFhirDiagnosticReport),
  ];
  return {
    resourceType: 'Bundle',
    type: 'collection',
    meta: { versionId: FHIR_VERSION },
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}
