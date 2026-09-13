'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { saveHistorySectionAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface HistorySectionView {
  section: string;
  title: string;
  items: ReadonlyArray<{ code: string; label: string }>;
}

/**
 * Historia clínica ADAPTATIVA (§NIVEL 5). Las secciones se computan en el
 * servidor según edad/sexo; aquí sólo se renderizan y editan. Un campo vacío
 * elimina el ítem. Autorización y scoping ocurren en el servidor.
 */
export function HistoryManager({
  patientId,
  sections,
  values,
  schemaVersion,
  canWrite,
}: {
  patientId: string;
  sections: HistorySectionView[];
  values: Record<string, string>;
  schemaVersion: string;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(saveHistorySectionAction, INITIAL);

  return (
    <ClinicalCard title="Historia clínica (adaptativa)">
      <p className="mos-muted">
        Secciones según edad y sexo del paciente · cuestionario v{schemaVersion}
      </p>

      {state.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {state.message}
        </Alert>
      ) : state.status === 'ok' ? (
        <Alert severity="success" title="Guardado">
          {state.message}
        </Alert>
      ) : null}

      <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
        <input type="hidden" name="patientId" value={patientId} />
        {sections.map((s) => (
          <fieldset key={s.section} className="mos-fieldset">
            <legend className="mos-section-label">{s.title}</legend>
            <div className="mos-field-grid">
              {s.items.map((it) => {
                const name = `item:${s.section}:${it.code}`;
                return (
                  <label key={it.code} className="mos-field">
                    <span>{it.label}</span>
                    <input
                      name={name}
                      defaultValue={values[`${s.section}:${it.code}`] ?? ''}
                      disabled={!canWrite}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {canWrite ? (
          <div className="mos-form__actions">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar historia'}
            </Button>
          </div>
        ) : null}
      </form>
    </ClinicalCard>
  );
}
