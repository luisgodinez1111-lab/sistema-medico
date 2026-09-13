/**
 * Helpers de PRESENTACIÓN de paciente (no lógica de dominio).
 * El formato de edad distingue lactantes/niños pequeños (meses) de adultos
 * (años), base de la historia adaptativa (§NIVEL 5).
 */

/** Edad en años cumplidos desde una fecha ISO (para la historia adaptativa). */
export function ageYears(birthDate: string, now: Date = new Date()): number {
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  return Math.max(0, years);
}

export function fullPatientName(p: {
  givenNames: string;
  firstSurname: string;
  secondSurname?: string | null;
}): string {
  return [p.givenNames, p.firstSurname, p.secondSurname].filter(Boolean).join(' ');
}

const SEX_LABEL: Record<string, string> = {
  female: 'Femenino',
  male: 'Masculino',
  other: 'Otro',
  unknown: 'No especificado',
};

export function sexLabel(sex: string): string {
  return SEX_LABEL[sex] ?? SEX_LABEL.unknown!;
}

/**
 * Etiqueta de edad legible desde una fecha ISO (YYYY-MM-DD).
 * < 2 años → meses (y días si < 1 mes); en adelante → años cumplidos.
 */
export function ageLabel(birthDate: string, now: Date = new Date()): string {
  const born = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '—';

  let years = now.getFullYear() - born.getFullYear();
  let months = now.getMonth() - born.getMonth();
  const days = now.getDate() - born.getDate();

  if (days < 0) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years >= 2) return `${years} a`;

  const totalMonths = years * 12 + months;
  if (totalMonths >= 1) return `${totalMonths} m`;

  const diffDays = Math.max(0, Math.floor((now.getTime() - born.getTime()) / 86_400_000));
  return `${diffDays} d`;
}
