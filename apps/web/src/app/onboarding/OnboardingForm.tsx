'use client';

import { useActionState } from 'react';
import { Button, Alert } from '@medical-os/design-system';
import { createClinicAction, type OnboardingState } from './actions';

const INITIAL: OnboardingState = { status: 'idle' };

export interface PackOption {
  id: string;
  name: string;
}

/** Alta de una clínica nueva (§28 paso 1). El usuario queda como administrador. */
export function OnboardingForm({ packs }: { packs: PackOption[] }) {
  const [state, action, pending] = useActionState(createClinicAction, INITIAL);

  return (
    <form action={action} className="mos-form" style={{ maxWidth: 520 }}>
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo crear la clínica">
          {state.message}
        </Alert>
      ) : null}

      <label className="mos-field">
        <span>Nombre de la clínica *</span>
        <input name="tenantName" required autoFocus placeholder="p.ej. Consultorio Dr. Pérez" />
      </label>
      <label className="mos-field">
        <span>Identificador (opcional)</span>
        <input name="tenantSlug" placeholder="se genera del nombre si lo dejas vacío" />
      </label>
      <div className="mos-field-grid">
        <label className="mos-field">
          <span>Organización (opcional)</span>
          <input name="orgName" placeholder="igual al nombre de la clínica" />
        </label>
        <label className="mos-field">
          <span>Consultorio (opcional)</span>
          <input name="facilityName" placeholder="Consultorio principal" />
        </label>
      </div>
      <div className="mos-field-grid">
        <label className="mos-field">
          <span>Especialidad</span>
          <select name="specialtyPackId" defaultValue="medicina-general">
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mos-field">
          <span>Tu especialidad (médico)</span>
          <input name="practitionerSpecialty" placeholder="p.ej. Medicina interna" />
        </label>
      </div>

      <div className="mos-form__actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creando…' : 'Crear clínica'}
        </Button>
      </div>
    </form>
  );
}
