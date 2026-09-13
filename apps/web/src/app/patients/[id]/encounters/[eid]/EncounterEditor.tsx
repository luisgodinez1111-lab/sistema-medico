'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import {
  saveEncounterDraftAction,
  signEncounterAction,
  type AllergyActionState,
} from '../../actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface EncounterDraft {
  id: string;
  reason: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}

/**
 * Editor SOAP de un encuentro en borrador (§NIVEL 6). Guardar (patient.write) y
 * Firmar (encounter.sign) son acciones de servidor separadas. Al firmar, la nota
 * queda inmutable (§33 #6) — esta vista sólo se muestra mientras es borrador.
 */
export function EncounterEditor({
  patientId,
  encounter,
  canSign,
}: {
  patientId: string;
  encounter: EncounterDraft;
  canSign: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveEncounterDraftAction, INITIAL);
  const [signState, signAction, signing] = useActionState(signEncounterAction, INITIAL);

  return (
    <ClinicalCard title="Nota de evolución (SOAP)">
      {saveState.status !== 'idle' ? (
        <Alert severity={saveState.status === 'ok' ? 'success' : 'critical'} title="Borrador">
          {saveState.message}
        </Alert>
      ) : null}
      {signState.status === 'error' ? (
        <Alert severity="critical" title="No se pudo firmar">
          {signState.message}
        </Alert>
      ) : null}

      <form action={saveAction} className="mos-form">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="encounterId" value={encounter.id} />
        <label className="mos-field">
          <span>Motivo de consulta</span>
          <input name="reason" defaultValue={encounter.reason ?? ''} />
        </label>
        <label className="mos-field">
          <span>S — Subjetivo</span>
          <textarea name="subjective" rows={2} defaultValue={encounter.subjective ?? ''} />
        </label>
        <label className="mos-field">
          <span>O — Objetivo</span>
          <textarea name="objective" rows={2} defaultValue={encounter.objective ?? ''} />
        </label>
        <label className="mos-field">
          <span>A — Análisis</span>
          <textarea name="assessment" rows={2} defaultValue={encounter.assessment ?? ''} />
        </label>
        <label className="mos-field">
          <span>P — Plan</span>
          <textarea name="plan" rows={2} defaultValue={encounter.plan ?? ''} />
        </label>
        <div className="mos-form__actions">
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        </div>
      </form>

      <div style={{ height: 'var(--space-4)' }} />
      <Alert severity="warning" title="Firmar cierra la nota">
        Al firmar, la nota queda inmutable y se registra su procedencia. Guarda el borrador antes de
        firmar.
      </Alert>
      {canSign ? (
        <form action={signAction} style={{ marginTop: 'var(--space-2)' }}>
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="encounterId" value={encounter.id} />
          <Button type="submit" variant="primary" disabled={signing}>
            {signing ? 'Firmando…' : 'Firmar encuentro'}
          </Button>
        </form>
      ) : (
        <p className="mos-muted">Tu rol no tiene permiso para firmar (`encounter.sign`).</p>
      )}
    </ClinicalCard>
  );
}
