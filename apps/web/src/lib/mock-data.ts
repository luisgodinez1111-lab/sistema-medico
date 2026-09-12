/**
 * Datos SINTÉTICOS para el prototipo navegable (gate NIVEL 1: prototipo antes de
 * datos reales). NUNCA usar datos productivos ni PHI real aquí (§16, §33).
 * Se reemplazarán por queries reales al llegar NIVEL 3 (Clinical Data Foundation).
 */

export interface MockPatient {
  id: string;
  fullName: string;
  ageLabel: string;
  sexLabel: string;
  mrn: string;
  allergies: string[];
  allergiesAssessed: boolean;
  activeProblems: { label: string; since: string }[];
  medications: { name: string; dose: string; sig: string }[];
  recentResults: {
    name: string;
    value: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    date: string;
  }[];
  pending: {
    label: string;
    owner: string;
    due: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
  timeline: { date: string; kind: string; summary: string }[];
}

export const MOCK_PATIENTS: Record<string, MockPatient> = {
  'demo-adulto': {
    id: 'demo-adulto',
    fullName: 'María Fernanda Ruiz Delgado',
    ageLabel: '34 a',
    sexLabel: 'Femenino',
    mrn: '000123',
    allergies: ['Penicilina (anafilaxia)'],
    allergiesAssessed: true,
    activeProblems: [
      { label: 'Diabetes mellitus tipo 2', since: '2021' },
      { label: 'Hipertensión arterial', since: '2022' },
    ],
    medications: [
      { name: 'Metformina', dose: '850 mg', sig: '1 tab c/12 h VO' },
      { name: 'Losartán', dose: '50 mg', sig: '1 tab c/24 h VO' },
    ],
    recentResults: [
      { name: 'HbA1c', value: '8.1 %', flag: 'high', date: '2026-09-01' },
      { name: 'Creatinina', value: '0.9 mg/dL', flag: 'normal', date: '2026-09-01' },
      { name: 'TA', value: '138/86 mmHg', flag: 'high', date: '2026-09-10' },
    ],
    pending: [
      {
        label: 'Revisar HbA1c 8.1% y ajustar plan',
        owner: 'Dr. Godínez',
        due: 'Hoy',
        severity: 'warning',
      },
      { label: 'Confirmar cita de nutrición', owner: 'Recepción', due: 'Mañana', severity: 'info' },
    ],
    timeline: [
      {
        date: '2026-09-10',
        kind: 'Consulta',
        summary: 'Control DM2/HTA. Ajuste de estilo de vida.',
      },
      { date: '2026-09-01', kind: 'Laboratorio', summary: 'Química sanguínea + HbA1c.' },
      { date: '2026-06-12', kind: 'Consulta', summary: 'Seguimiento trimestral.' },
    ],
  },
  'demo-pediatrico': {
    id: 'demo-pediatrico',
    fullName: 'Santiago Herrera López',
    ageLabel: '6 m 12 d',
    sexLabel: 'Masculino',
    mrn: '000456',
    allergies: [],
    allergiesAssessed: true,
    activeProblems: [{ label: 'Control de niño sano', since: '2026' }],
    medications: [{ name: 'Vitamina D', dose: '400 UI', sig: '1 gota c/24 h VO' }],
    recentResults: [{ name: 'Peso', value: '7.8 kg (P50)', flag: 'normal', date: '2026-09-05' }],
    pending: [
      {
        label: 'Vacuna: refuerzo pentavalente (6 m)',
        owner: 'Enfermería',
        due: 'Hoy',
        severity: 'warning',
      },
    ],
    timeline: [
      {
        date: '2026-09-05',
        kind: 'Consulta',
        summary: 'Control niño sano 6 meses. Antropometría normal.',
      },
      { date: '2026-06-04', kind: 'Vacuna', summary: 'Esquema 4 meses aplicado.' },
    ],
  },
};

export function getMockPatient(id: string): MockPatient | undefined {
  return MOCK_PATIENTS[id];
}

export function listMockPatients(): MockPatient[] {
  return Object.values(MOCK_PATIENTS);
}
