import { err, ok, ValidationError, type Result, type DomainError } from '@medical-os/shared';
import type { NewPatientInput } from './repositories/patient';
import type { NewAllergyInput } from './repositories/allergy';
import type { NewConditionInput } from './repositories/condition';
import type { NewObservationInput } from './repositories/observation';

/**
 * Importador FHIR R4 (Release R5) — adaptador de ENTRADA. Mapea recursos FHIR
 * externos al modelo interno como create-inputs (el inverso de `fhir.ts`).
 *
 * Reglas:
 * - Es un mapeo puro y read-only sobre el JSON de entrada; no escribe nada. La
 *   capa de aplicación resuelve/crea el paciente y luego adjunta los recursos.
 * - Los inputs de recursos NO llevan `patientId`: lo asigna el llamador tras
 *   resolver a qué paciente del tenant pertenecen (aislamiento; ADR-0002).
 * - Validación explícita: entradas malformadas producen ValidationError, nunca
 *   se silencian (~/.claude/CLAUDE.md).
 * - Los recursos no soportados se cuentan en `skipped`, no rompen el import.
 */

export type FhirJson = Record<string, unknown>;

/** Recursos clínicos importados, listos para adjuntar a un paciente del tenant. */
export type ImportedAllergy = Omit<NewAllergyInput, 'patientId'>;
export type ImportedCondition = Omit<NewConditionInput, 'patientId'>;
export type ImportedObservation = Omit<NewObservationInput, 'patientId'>;

export interface ImportedRecord {
  patient?: NewPatientInput;
  allergies: ImportedAllergy[];
  conditions: ImportedCondition[];
  observations: ImportedObservation[];
  /** Recursos ignorados por no estar soportados (resourceType → conteo). */
  skipped: Record<string, number>;
}

function obj(v: unknown): FhirJson | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as FhirJson) : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Extrae el texto de un CodeableConcept FHIR: `text` o el primer `coding[].code`. */
function conceptText(v: unknown): string | null {
  const c = obj(v);
  if (!c) return null;
  const text = str(c['text']);
  if (text) return text;
  const first = obj(arr(c['coding'])[0]);
  return first ? (str(first['display']) ?? str(first['code'])) : null;
}

const SEX_IN: Record<string, NewPatientInput['sex']> = {
  female: 'female',
  male: 'male',
  other: 'other',
  unknown: 'unknown',
};

const ALLERGY_CRITICALITY: Record<string, NonNullable<ImportedAllergy['criticality']>> = {
  low: 'low',
  high: 'high',
  'unable-to-assess': 'unable-to-assess',
};

export function parseFhirPatient(resource: FhirJson): Result<NewPatientInput, DomainError> {
  if (resource['resourceType'] !== 'Patient') {
    return err(new ValidationError('El recurso no es un Patient FHIR.'));
  }
  const name = obj(arr(resource['name'])[0]);
  const given = name ? arr(name['given']).map(str).filter(Boolean).join(' ') : '';
  const family = name ? (str(name['family']) ?? '') : '';
  const familyParts = family.split(/\s+/).filter(Boolean);
  const birthDate = str(resource['birthDate']);

  if (!given) return err(new ValidationError('Patient sin nombre (name.given).'));
  if (familyParts.length === 0) {
    return err(new ValidationError('Patient sin apellido (name.family).'));
  }
  if (!birthDate) return err(new ValidationError('Patient sin fecha de nacimiento (birthDate).'));

  const identifiers = arr(resource['identifier']).map(obj);
  const findId = (system: string): string | undefined => {
    for (const id of identifiers) {
      if (id && str(id['system']) === system) return str(id['value']) ?? undefined;
    }
    return undefined;
  };
  const genderRaw = str(resource['gender']);

  const input: NewPatientInput = {
    givenNames: given,
    firstSurname: familyParts[0]!,
    ...(familyParts.length > 1 ? { secondSurname: familyParts.slice(1).join(' ') } : {}),
    birthDate,
    ...(genderRaw && SEX_IN[genderRaw] ? { sex: SEX_IN[genderRaw] } : {}),
    ...(findId('urn:mos:mrn') ? { mrn: findId('urn:mos:mrn')! } : {}),
    ...(findId('urn:mx:curp') ? { curp: findId('urn:mx:curp')! } : {}),
  };
  return ok(input);
}

export function parseFhirAllergy(resource: FhirJson): Result<ImportedAllergy, DomainError> {
  if (resource['resourceType'] !== 'AllergyIntolerance') {
    return err(new ValidationError('El recurso no es un AllergyIntolerance FHIR.'));
  }
  const substance = conceptText(resource['code']);
  if (!substance) return err(new ValidationError('AllergyIntolerance sin sustancia (code).'));
  const criticalityRaw = str(resource['criticality']);
  const reaction = obj(arr(resource['reaction'])[0]);
  const manifestation = reaction ? conceptText(arr(reaction['manifestation'])[0]) : null;

  const input: ImportedAllergy = {
    substance,
    ...(criticalityRaw && ALLERGY_CRITICALITY[criticalityRaw]
      ? { criticality: ALLERGY_CRITICALITY[criticalityRaw] }
      : {}),
    ...(manifestation ? { reaction: manifestation } : {}),
  };
  return ok(input);
}

export function parseFhirCondition(resource: FhirJson): Result<ImportedCondition, DomainError> {
  if (resource['resourceType'] !== 'Condition') {
    return err(new ValidationError('El recurso no es un Condition FHIR.'));
  }
  const code = conceptText(resource['code']);
  if (!code) return err(new ValidationError('Condition sin código (code).'));
  const onset = str(resource['onsetDateTime']);
  const input: ImportedCondition = {
    code,
    ...(onset ? { onsetDate: onset.slice(0, 10) } : {}),
  };
  return ok(input);
}

export function parseFhirObservation(resource: FhirJson): Result<ImportedObservation, DomainError> {
  if (resource['resourceType'] !== 'Observation') {
    return err(new ValidationError('El recurso no es un Observation FHIR.'));
  }
  const code = conceptText(resource['code']);
  if (!code) return err(new ValidationError('Observation sin código (code).'));

  // valueString directo, o valueQuantity {value, unit}.
  let valueText = str(resource['valueString']);
  let unit: string | null = null;
  const qty = obj(resource['valueQuantity']);
  if (!valueText && qty) {
    const n = qty['value'];
    if (typeof n === 'number') valueText = String(n);
    unit = str(qty['unit']);
  }
  if (!valueText)
    return err(new ValidationError('Observation sin valor (valueString/valueQuantity).'));

  const effective = str(resource['effectiveDateTime']);
  const input: ImportedObservation = {
    code,
    valueText,
    ...(unit ? { unit } : {}),
    ...(effective ? { effectiveAt: new Date(effective) } : {}),
  };
  return ok(input);
}

/**
 * Importa un Bundle FHIR (o un único recurso). Los recursos válidos se agrupan
 * por tipo; los no soportados se cuentan en `skipped`. Un recurso malformado de
 * tipo soportado aborta el import con ValidationError (integridad del expediente).
 */
export function parseFhirBundle(input: FhirJson): Result<ImportedRecord, DomainError> {
  const record: ImportedRecord = {
    allergies: [],
    conditions: [],
    observations: [],
    skipped: {},
  };

  const resources: FhirJson[] =
    input['resourceType'] === 'Bundle'
      ? arr(input['entry'])
          .map((e) => obj(e))
          .map((e) => (e ? obj(e['resource']) : null))
          .filter((r): r is FhirJson => r !== null)
      : [input];

  if (resources.length === 0) {
    return err(new ValidationError('Bundle FHIR vacío o sin recursos.'));
  }

  for (const r of resources) {
    switch (r['resourceType']) {
      case 'Patient': {
        const parsed = parseFhirPatient(r);
        if (!parsed.ok) return parsed;
        if (record.patient) {
          return err(new ValidationError('El Bundle contiene más de un Patient.'));
        }
        record.patient = parsed.value;
        break;
      }
      case 'AllergyIntolerance': {
        const parsed = parseFhirAllergy(r);
        if (!parsed.ok) return parsed;
        record.allergies.push(parsed.value);
        break;
      }
      case 'Condition': {
        const parsed = parseFhirCondition(r);
        if (!parsed.ok) return parsed;
        record.conditions.push(parsed.value);
        break;
      }
      case 'Observation': {
        const parsed = parseFhirObservation(r);
        if (!parsed.ok) return parsed;
        record.observations.push(parsed.value);
        break;
      }
      default: {
        const t = str(r['resourceType']) ?? 'unknown';
        record.skipped[t] = (record.skipped[t] ?? 0) + 1;
      }
    }
  }
  return ok(record);
}
