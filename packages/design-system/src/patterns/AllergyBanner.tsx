export interface AllergyBannerProps {
  /** Lista de alergias confirmadas. Vacío = "sin alergias conocidas" explícito. */
  allergies: ReadonlyArray<string>;
  /**
   * Si el estado de alergias NO ha sido documentado. Es distinto de "sin
   * alergias": nunca se colapsa ausencia de dato con negativo (§NIVEL 5).
   */
  notAssessed?: boolean;
}

/**
 * Banda de alergias. Regla de seguridad (§27): no esconder resultados críticos
 * tras badges ambiguos. Muestra explícitamente alergias, "sin alergias
 * conocidas" o "no evaluado".
 */
export function AllergyBanner({ allergies, notAssessed = false }: AllergyBannerProps) {
  if (notAssessed) {
    return (
      <div className="mos-allergy-banner mos-allergy-banner--none" role="status">
        <span aria-hidden="true">⚠</span>
        Alergias no evaluadas — documentar antes de prescribir
      </div>
    );
  }

  if (allergies.length === 0) {
    return (
      <div className="mos-allergy-banner mos-allergy-banner--none" role="status">
        Sin alergias conocidas (NKDA)
      </div>
    );
  }

  return (
    <div className="mos-allergy-banner" role="alert">
      <span aria-hidden="true">⛔</span>
      Alergias: {allergies.join(', ')}
    </div>
  );
}
