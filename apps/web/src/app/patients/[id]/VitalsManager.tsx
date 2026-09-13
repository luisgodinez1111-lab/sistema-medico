'use client';

import { useActionState, useState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { addVitalAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface VitalView {
  id: string;
  code: string;
  valueText: string;
  unit: string | null;
  effectiveAt: string;
}

/** Plantilla de observación sugerida por el pack de especialidad (§R7). */
export interface VitalTemplate {
  code: string;
  label: string;
  unit?: string;
}

/** Signos vitales estándar disponibles siempre. */
const STANDARD_VITALS: ReadonlyArray<{ code: string; label: string; unit?: string }> = [
  { code: 'blood-pressure', label: 'Tensión arterial', unit: 'mmHg' },
  { code: 'heart-rate', label: 'Frecuencia cardiaca', unit: 'lpm' },
  { code: 'respiratory-rate', label: 'Frecuencia respiratoria', unit: 'rpm' },
  { code: 'temperature', label: 'Temperatura', unit: '°C' },
  { code: 'weight', label: 'Peso', unit: 'kg' },
  { code: 'height', label: 'Talla', unit: 'cm' },
  { code: 'spo2', label: 'SpO₂', unit: '%' },
];

function labelFor(code: string, options: ReadonlyArray<{ code: string; label: string }>): string {
  return options.find((o) => o.code === code)?.label ?? code;
}

/**
 * Lista y alta de signos vitales (§NIVEL 3, §28 paso 6). Las plantillas del pack
 * de especialidad (R7) rellenan código + unidad en un clic; el clínico sólo teclea
 * el valor. Autorización y scoping en el servidor.
 */
export function VitalsManager({
  patientId,
  vitals,
  canWrite,
  templates = [],
}: {
  patientId: string;
  vitals: VitalView[];
  canWrite: boolean;
  templates?: ReadonlyArray<VitalTemplate>;
}) {
  const [state, action, pending] = useActionState(addVitalAction, INITIAL);

  // Opciones del select = estándar + plantillas del pack (sin duplicar por code).
  const options = [...STANDARD_VITALS];
  for (const t of templates) {
    if (!options.some((o) => o.code === t.code)) {
      options.push(
        t.unit !== undefined
          ? { code: t.code, label: t.label, unit: t.unit }
          : { code: t.code, label: t.label },
      );
    }
  }
  const unitByCode = new Map(options.map((o) => [o.code, o.unit ?? '']));

  const [code, setCode] = useState(options[0]?.code ?? 'blood-pressure');
  const [unit, setUnit] = useState(unitByCode.get(code) ?? '');

  function pick(nextCode: string): void {
    setCode(nextCode);
    setUnit(unitByCode.get(nextCode) ?? '');
  }

  return (
    <ClinicalCard title="Signos vitales">
      {vitals.length === 0 ? (
        <p className="mos-muted">Sin signos vitales registrados.</p>
      ) : (
        <ul className="mos-list">
          {vitals.map((v) => (
            <li key={v.id} className="mos-list__item">
              <span>
                {labelFor(v.code, options)}:{' '}
                <strong>
                  {v.valueText}
                  {v.unit ? ` ${v.unit}` : ''}
                </strong>
              </span>
              <span className="mos-muted">{v.effectiveAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : (
        <>
          {templates.length > 0 ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <p className="mos-section-label">Plantillas de la especialidad (DEMO)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {templates.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => pick(t.code)}
                    title={`Usar plantilla: ${t.label}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <Badge tone={code === t.code ? 'info' : 'neutral'}>{t.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {state.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {state.message}
            </Alert>
          ) : null}
          <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <div className="mos-field-grid">
              <label className="mos-field">
                <span>Signo vital / medición</span>
                <select name="code" value={code} onChange={(e) => pick(e.target.value)}>
                  {options.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mos-field">
                <span>Valor</span>
                <input name="valueText" required placeholder="p.ej. 138/86" />
              </label>
              <label className="mos-field">
                <span>Unidad (opcional)</span>
                <input
                  name="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="p.ej. mmHg"
                />
              </label>
            </div>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Guardando…' : 'Registrar signo vital'}
              </Button>
            </div>
          </form>
        </>
      )}
    </ClinicalCard>
  );
}
