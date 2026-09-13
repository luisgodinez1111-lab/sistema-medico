/** Formatea centavos enteros como moneda (por defecto MXN). Sin floats en datos. */
export function formatMoney(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

/** Convierte un monto en pesos (string del formulario) a centavos enteros. */
export function pesosToCents(value: string): number {
  const n = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
