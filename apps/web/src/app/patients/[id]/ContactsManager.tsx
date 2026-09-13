'use client';

import { useActionState } from 'react';
import { Button, Alert, Badge } from '@medical-os/design-system';
import { addRelatedPersonAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ContactView {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  isEmergencyContact: boolean;
}

const REL_LABEL: Record<string, string> = {
  mother: 'Madre',
  father: 'Padre',
  guardian: 'Tutor/a',
  spouse: 'Cónyuge',
  sibling: 'Hermano/a',
  child: 'Hijo/a',
  caregiver: 'Cuidador/a',
  'emergency-contact': 'Emergencia',
  other: 'Otro',
};

/**
 * Contactos / familiares del paciente (§NIVEL 3, §26). Vive en el context rail.
 * Autorización y scoping en el servidor.
 */
export function ContactsManager({
  patientId,
  contacts,
  canWrite,
}: {
  patientId: string;
  contacts: ContactView[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(addRelatedPersonAction, INITIAL);

  return (
    <div>
      <p className="mos-section-label">Contactos</p>
      {contacts.length === 0 ? (
        <p className="mos-muted">Sin contactos registrados.</p>
      ) : (
        <ul className="mos-list">
          {contacts.map((c) => (
            <li key={c.id} className="mos-list__item">
              <span>
                <strong>{c.name}</strong>
                <br />
                <span className="mos-muted">
                  {REL_LABEL[c.relationship] ?? c.relationship}
                  {c.phone ? ` · ${c.phone}` : ''}
                </span>
              </span>
              {c.isEmergencyContact ? <Badge tone="warning">Emergencia</Badge> : null}
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : (
        <>
          {state.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {state.message}
            </Alert>
          ) : null}
          <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <label className="mos-field">
              <span>Nombre</span>
              <input name="name" required placeholder="p.ej. Laura Herrera" />
            </label>
            <label className="mos-field">
              <span>Parentesco</span>
              <select name="relationship" defaultValue="mother">
                <option value="mother">Madre</option>
                <option value="father">Padre</option>
                <option value="guardian">Tutor/a</option>
                <option value="spouse">Cónyuge</option>
                <option value="sibling">Hermano/a</option>
                <option value="caregiver">Cuidador/a</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="mos-field">
              <span>Teléfono (opcional)</span>
              <input name="phone" placeholder="p.ej. 555-1234" />
            </label>
            <label className="mos-field mos-field--inline">
              <input type="checkbox" name="isEmergencyContact" />
              <span>Contacto de emergencia</span>
            </label>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Guardando…' : 'Agregar contacto'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
