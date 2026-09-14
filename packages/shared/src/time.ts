/**
 * Helpers de tiempo. Regla del plan (§NIVEL 11, §33): nunca guardar fechas
 * clínicas importantes como strings locales; se persisten como instantes UTC
 * (ISO 8601) y la zona horaria de la facility se aplica en presentación.
 */

/** Instante en UTC, ISO 8601. Tipo nominal para no confundir con strings libres. */
export type IsoInstant = string & { readonly __iso: unique symbol };

export function nowUtc(): IsoInstant {
  return new Date().toISOString() as IsoInstant;
}

export function toIsoInstant(date: Date): IsoInstant {
  return date.toISOString() as IsoInstant;
}

export function parseIsoInstant(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Instante ISO inválido');
  }
  return d;
}

/**
 * Suma `n` días HÁBILES (excluye sábado y domingo) a una fecha. Base para los
 * plazos legales ARCO de LFPDPPP (§NIVEL 18): 20 días hábiles para responder. NO
 * contempla días festivos oficiales — se documenta como aproximación conservadora.
 */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

/** Edad en años/meses/días a una fecha de referencia (para perfiles clínicos, §NIVEL 5). */
export interface PreciseAge {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

export function preciseAge(birthDate: Date, at: Date = new Date()): PreciseAge {
  const totalDays = Math.floor((at.getTime() - birthDate.getTime()) / 86_400_000);

  let years = at.getFullYear() - birthDate.getFullYear();
  let months = at.getMonth() - birthDate.getMonth();
  let days = at.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(at.getFullYear(), at.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days, totalDays };
}
