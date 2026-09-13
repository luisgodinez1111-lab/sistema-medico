import { describe, it, expect } from 'vitest';
import {
  parseFhirPatient,
  parseFhirAllergy,
  parseFhirCondition,
  parseFhirObservation,
  parseFhirBundle,
} from './fhir-import';
import { toFhirPatient, toFhirAllergy, toFhirCondition, buildPatientBundle } from './fhir';

describe('parseFhirPatient', () => {
  it('mapea nombre, apellidos, sexo e identificadores', () => {
    const r = parseFhirPatient({
      resourceType: 'Patient',
      name: [{ family: 'Pérez López', given: ['Ana', 'María'] }],
      gender: 'female',
      birthDate: '1990-05-01',
      identifier: [
        { system: 'urn:mos:mrn', value: 'MRN-1' },
        { system: 'urn:mx:curp', value: 'CURP123' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      givenNames: 'Ana María',
      firstSurname: 'Pérez',
      secondSurname: 'López',
      sex: 'female',
      birthDate: '1990-05-01',
      mrn: 'MRN-1',
      curp: 'CURP123',
    });
  });

  it('rechaza recurso que no es Patient', () => {
    const r = parseFhirPatient({ resourceType: 'Observation' });
    expect(r.ok).toBe(false);
  });

  it('rechaza Patient sin apellido o sin fecha de nacimiento', () => {
    expect(parseFhirPatient({ resourceType: 'Patient', name: [{ given: ['Ana'] }] }).ok).toBe(
      false,
    );
    expect(
      parseFhirPatient({ resourceType: 'Patient', name: [{ family: 'Pérez', given: ['Ana'] }] }).ok,
    ).toBe(false);
  });

  it('round-trip export → import conserva los datos', () => {
    const exported = toFhirPatient({
      id: 'pt_1',
      mrn: 'MRN-9',
      curp: 'CURPX',
      givenNames: 'Juan Carlos',
      firstSurname: 'Gómez',
      secondSurname: 'Ruiz',
      sex: 'male',
      birthDate: '1985-12-20',
    });
    const r = parseFhirPatient(exported);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      givenNames: 'Juan Carlos',
      firstSurname: 'Gómez',
      secondSurname: 'Ruiz',
      sex: 'male',
      birthDate: '1985-12-20',
      mrn: 'MRN-9',
      curp: 'CURPX',
    });
  });
});

describe('parseFhirAllergy / Condition / Observation', () => {
  it('mapea alergia con criticidad y reacción', () => {
    const r = parseFhirAllergy(
      toFhirAllergy({
        id: 'al_1',
        patientId: 'pt_1',
        substance: 'Penicilina',
        criticality: 'high',
        clinicalStatus: 'active',
        reaction: 'Urticaria',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      substance: 'Penicilina',
      criticality: 'high',
      reaction: 'Urticaria',
    });
  });

  it('mapea condición con onset recortado a YYYY-MM-DD', () => {
    const r = parseFhirCondition(
      toFhirCondition({
        id: 'c_1',
        patientId: 'pt_1',
        code: 'Diabetes tipo 2',
        clinicalStatus: 'active',
        onsetDate: '2020-01-15',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ code: 'Diabetes tipo 2', onsetDate: '2020-01-15' });
  });

  it('mapea observación con valueQuantity', () => {
    const r = parseFhirObservation({
      resourceType: 'Observation',
      code: { text: 'Peso' },
      valueQuantity: { value: 72.5, unit: 'kg' },
      effectiveDateTime: '2026-09-01T10:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.code).toBe('Peso');
    expect(r.value.valueText).toBe('72.5');
    expect(r.value.unit).toBe('kg');
    expect(r.value.effectiveAt).toBeInstanceOf(Date);
  });

  it('rechaza observación sin valor', () => {
    expect(parseFhirObservation({ resourceType: 'Observation', code: { text: 'X' } }).ok).toBe(
      false,
    );
  });
});

describe('parseFhirBundle', () => {
  it('agrupa recursos por tipo y cuenta los no soportados', () => {
    const bundle = buildPatientBundle({
      patient: {
        id: 'pt_1',
        mrn: 'MRN-1',
        curp: null,
        givenNames: 'Ana',
        firstSurname: 'Pérez',
        secondSurname: null,
        sex: 'female',
        birthDate: '1990-05-01',
      },
      allergies: [
        {
          id: 'al_1',
          patientId: 'pt_1',
          substance: 'Penicilina',
          criticality: 'high',
          clinicalStatus: 'active',
          reaction: null,
        },
      ],
      conditions: [
        { id: 'c_1', patientId: 'pt_1', code: 'HTA', clinicalStatus: 'active', onsetDate: null },
      ],
      observations: [],
      medications: [
        {
          id: 'm_1',
          patientId: 'pt_1',
          drug: 'Metformina',
          dose: '850mg',
          route: 'oral',
          frequency: 'c/12h',
          status: 'active',
        },
      ],
      encounters: [],
      orders: [],
      reports: [],
    });

    const r = parseFhirBundle(bundle);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.patient?.givenNames).toBe('Ana');
    expect(r.value.allergies).toHaveLength(1);
    expect(r.value.conditions).toHaveLength(1);
    // MedicationRequest no está soportado en import todavía → contado en skipped.
    expect(r.value.skipped['MedicationRequest']).toBe(1);
  });

  it('acepta un único recurso suelto (no-Bundle)', () => {
    const r = parseFhirBundle({
      resourceType: 'Condition',
      code: { text: 'Asma' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.conditions).toHaveLength(1);
  });

  it('aborta si un recurso soportado está malformado', () => {
    const r = parseFhirBundle({
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'Condition' } }], // sin code
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza más de un Patient', () => {
    const p = {
      resourceType: 'Patient',
      name: [{ family: 'X', given: ['Y'] }],
      birthDate: '2000-01-01',
    };
    const r = parseFhirBundle({
      resourceType: 'Bundle',
      entry: [{ resource: p }, { resource: p }],
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza Bundle vacío', () => {
    expect(parseFhirBundle({ resourceType: 'Bundle', entry: [] }).ok).toBe(false);
  });
});
