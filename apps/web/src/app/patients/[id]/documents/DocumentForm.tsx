'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { registerDocumentAction, type DocActionState } from './actions';

const INITIAL: DocActionState = { status: 'idle' };

/** Registro de metadata de documento (R5). No sube archivo (stub). */
export function DocumentForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(registerDocumentAction, INITIAL);
  return (
    <ClinicalCard title="Registrar documento">
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo registrar">
          {state.message}
        </Alert>
      ) : state.status === 'ok' ? (
        <Alert severity="success" title="Registrado">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="mos-form">
        <input type="hidden" name="patientId" value={patientId} />
        <div className="mos-field-grid">
          <label className="mos-field">
            <span>Título</span>
            <input name="title" required placeholder="p.ej. Radiografía de tórax" />
          </label>
          <label className="mos-field">
            <span>Tipo de contenido</span>
            <select name="contentType" defaultValue="application/pdf">
              <option value="application/pdf">PDF</option>
              <option value="image/jpeg">Imagen JPEG</option>
              <option value="image/png">Imagen PNG</option>
              <option value="application/dicom">DICOM</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Fecha del documento/estudio (opcional)</span>
            <input name="documentDate" type="date" />
          </label>
        </div>
        <div className="mos-form__actions">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Registrando…' : 'Registrar documento'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
