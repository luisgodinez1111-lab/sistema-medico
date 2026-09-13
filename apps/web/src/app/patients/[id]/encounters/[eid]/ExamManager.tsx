'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { saveExamAction, type AllergyActionState } from '../../actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ExamSectionView {
  section: string;
  title: string;
}

export interface ExamFindingView {
  section: string;
  normal: boolean;
  note: string | null;
}

/**
 * Exploración física estructurada (§28 paso 6). Por aparato/sistema: No explorado
 * / Normal / Anormal + hallazgos. De aquí se deriva el "Objetivo (O)" de la nota,
 * que la firma congela. Editable sólo en borrador.
 */
export function ExamManager({
  patientId,
  encounterId,
  sections,
  findings,
}: {
  patientId: string;
  encounterId: string;
  sections: ExamSectionView[];
  findings: ExamFindingView[];
}) {
  const [state, action, pending] = useActionState(saveExamAction, INITIAL);
  const bySection = new Map(findings.map((f) => [f.section, f]));

  return (
    <ClinicalCard title="Exploración física (Objetivo)">
      <p className="mos-muted">
        Por aparatos y sistemas. El Objetivo (O) de la nota se genera de aquí.
      </p>
      {state.status !== 'idle' ? (
        <Alert severity={state.status === 'ok' ? 'success' : 'critical'} title="Exploración">
          {state.message}
        </Alert>
      ) : null}

      <form action={action} className="mos-form" style={{ marginTop: 'var(--space-2)' }}>
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="encounterId" value={encounterId} />
        {sections.map((s) => {
          const f = bySection.get(s.section);
          const status = f ? (f.normal ? 'normal' : 'abnormal') : '';
          return (
            <div key={s.section} className="mos-field-grid" style={{ alignItems: 'end' }}>
              <label className="mos-field">
                <span>{s.title}</span>
                <select name={`status_${s.section}`} defaultValue={status}>
                  <option value="">No explorado</option>
                  <option value="normal">Normal</option>
                  <option value="abnormal">Anormal</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Hallazgos (si anormal)</span>
                <input name={`note_${s.section}`} defaultValue={f?.note ?? ''} />
              </label>
            </div>
          );
        })}
        <div className="mos-form__actions">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar exploración'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
