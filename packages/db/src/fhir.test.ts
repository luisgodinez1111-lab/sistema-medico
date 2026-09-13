import { describe, it, expect } from 'vitest';
import {
  toFhirPatient,
  toFhirCondition,
  toFhirEncounter,
  buildPatientBundle,
  FHIR_VERSION,
  type FhirResource,
} from './fhir';

/** Acceso tipado laxo a un recurso FHIR para aserciones (evita `any`). */
function field<T>(r: FhirResource, key: string): T {
  return r[key] as T;
}

describe('Exportador FHIR (R5)', () => {
  const patient = {
    id: 'p1',
    mrn: '000123',
    curp: 'RUDM910412MDFXLR01',
    givenNames: 'María Fernanda',
    firstSurname: 'Ruiz',
    secondSurname: 'Delgado',
    sex: 'female',
    birthDate: '1991-04-12',
  };

  it('mapea Patient con identificadores MRN/CURP, nombre y género', () => {
    const r = toFhirPatient(patient);
    expect(r.resourceType).toBe('Patient');
    expect(r.gender).toBe('female');
    expect(r.birthDate).toBe('1991-04-12');
    expect(field<{ value: string }[]>(r, 'identifier').map((i) => i.value)).toEqual([
      '000123',
      'RUDM910412MDFXLR01',
    ]);
    const name = field<{ family: string; given: string[] }[]>(r, 'name')[0]!;
    expect(name.family).toBe('Ruiz Delgado');
    expect(name.given).toEqual(['María', 'Fernanda']);
  });

  it('sexo desconocido cae en unknown', () => {
    expect(toFhirPatient({ ...patient, sex: 'x' }).gender).toBe('unknown');
  });

  it('Condition referencia al paciente y mapea onset', () => {
    const r = toFhirCondition({
      id: 'c1',
      patientId: 'p1',
      code: 'Diabetes mellitus tipo 2',
      clinicalStatus: 'active',
      onsetDate: '2021-01-01',
    });
    expect(r.resourceType).toBe('Condition');
    expect(field<{ reference: string }>(r, 'subject').reference).toBe('Patient/p1');
    expect(r.onsetDateTime).toBe('2021-01-01');
  });

  it('Encounter firmado → status finished con period.end', () => {
    const r = toFhirEncounter({
      id: 'e1',
      patientId: 'p1',
      status: 'signed',
      startedAt: new Date('2026-09-10T10:00:00Z'),
      signedAt: new Date('2026-09-10T10:30:00Z'),
      reason: 'Control',
    });
    expect(r.status).toBe('finished');
    expect(field<{ end: string }>(r, 'period').end).toBe('2026-09-10T10:30:00.000Z');
  });

  it('buildPatientBundle arma un Bundle collection con todos los recursos', () => {
    const bundle = buildPatientBundle({
      patient,
      allergies: [
        {
          id: 'a1',
          patientId: 'p1',
          substance: 'Penicilina',
          criticality: 'high',
          clinicalStatus: 'active',
          reaction: 'anafilaxia',
        },
      ],
      conditions: [
        { id: 'c1', patientId: 'p1', code: 'DM2', clinicalStatus: 'active', onsetDate: null },
      ],
      observations: [],
      medications: [],
      encounters: [],
      orders: [],
      reports: [],
    });
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(field<{ versionId: string }>(bundle, 'meta').versionId).toBe(FHIR_VERSION);
    expect(bundle.total).toBe(3); // Patient + Allergy + Condition
    const entries = field<{ resource: FhirResource }[]>(bundle, 'entry');
    expect(entries[0]!.resource.resourceType).toBe('Patient');
  });
});
