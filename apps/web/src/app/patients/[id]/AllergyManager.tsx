'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { addAllergyAction, markNoKnownAllergiesAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface AllergyView {
  id: string;
  substance: string;
  category: string;
  criticality: 'low' | 'high' | 'unable-to-assess';
  reaction: string | null;
}

const CRIT_LABEL: Record<string, string> = {
  high: 'Alta',
  low: 'Baja',
  'unable-to-assess': 'Sin evaluar',
};

/**
 * Gestión de alergias del paciente (§NIVEL 3). Lista las actuales y permite
 * registrar una nueva o marcar "sin alergias conocidas" (NKDA explícito).
 * La autorización y el scoping ocurren en el servidor.
 */
export function AllergyManager({
  patientId,
  allergies,
  reviewed,
  canWrite,
}: {
  patientId: string;
  allergies: AllergyView[];
  reviewed: boolean;
  canWrite: boolean;
}) {
  const [addState, addAction, adding] = useActionState(addAllergyAction, INITIAL);
  const [nkaState, nkaAction, markingNka] = useActionState(markNoKnownAllergiesAction, INITIAL);

  return (
    <ClinicalCard title="Alergias">
      {allergies.length === 0 ? (
        <p className="mos-muted">
          {reviewed ? 'Sin alergias conocidas (NKDA).' : 'Estado de alergias no evaluado.'}
        </p>
      ) : (
        <ul className="mos-list">
          {allergies.map((a) => (
            <li key={a.id} className="mos-list__item">
              <span>
                <strong>{a.substance}</strong>
                {a.reaction ? <span className="mos-muted"> · {a.reaction}</span> : null}
              </span>
              <Badge tone={a.criticality === 'high' ? 'critical' : 'warning'}>
                {CRIT_LABEL[a.criticality]}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : (
        <>
          {addState.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {addState.message}
            </Alert>
          ) : null}

          <form action={addAction} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <div className="mos-field-grid">
              <label className="mos-field">
                <span>Sustancia</span>
                <input name="substance" required placeholder="p.ej. Penicilina" />
              </label>
              <label className="mos-field">
                <span>Categoría</span>
                <select name="category" defaultValue="medication">
                  <option value="medication">Medicamento</option>
                  <option value="food">Alimento</option>
                  <option value="environment">Ambiental</option>
                  <option value="biologic">Biológico</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Criticidad</span>
                <select name="criticality" defaultValue="unable-to-assess">
                  <option value="high">Alta</option>
                  <option value="low">Baja</option>
                  <option value="unable-to-assess">Sin evaluar</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Reacción (opcional)</span>
                <input name="reaction" placeholder="p.ej. anafilaxia" />
              </label>
            </div>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={adding}>
                {adding ? 'Guardando…' : 'Registrar alergia'}
              </Button>
            </div>
          </form>

          {allergies.length === 0 && !reviewed ? (
            <form action={nkaAction} style={{ marginTop: 'var(--space-2)' }}>
              <input type="hidden" name="patientId" value={patientId} />
              <Button type="submit" variant="secondary" disabled={markingNka}>
                {markingNka ? 'Guardando…' : 'Marcar sin alergias conocidas'}
              </Button>
              {nkaState.status === 'error' ? (
                <span className="mos-field__error"> {nkaState.message}</span>
              ) : null}
            </form>
          ) : null}
        </>
      )}
    </ClinicalCard>
  );
}
