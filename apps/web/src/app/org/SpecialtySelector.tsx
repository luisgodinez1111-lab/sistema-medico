'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { setSpecialtyAction, type SpecialtyState } from './actions';

const INITIAL: SpecialtyState = { status: 'idle' };

export interface SpecialtyOption {
  id: string;
  name: string;
  description: string;
}

/**
 * Selector de especialidad de la clínica (R7). Sólo habilitado con permiso
 * `organization.manage`; en solo-lectura muestra la activa. El contenido de los
 * packs es DEMO (no validado clínicamente).
 */
export function SpecialtySelector({
  options,
  activeId,
  canManage,
}: {
  options: SpecialtyOption[];
  activeId: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setSpecialtyAction, INITIAL);
  const active = options.find((o) => o.id === activeId);

  return (
    <ClinicalCard title="Especialidad de la clínica">
      <p className="mos-muted">
        Adapta el expediente (secciones de historia, quick-picks). Contenido{' '}
        <strong>DEMO (no validado clínicamente)</strong>.
      </p>
      <p style={{ marginTop: 'var(--space-2)' }}>
        Activa: <Badge tone="info">{active?.name ?? activeId}</Badge>
      </p>

      {state.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {state.message}
        </Alert>
      ) : state.status === 'ok' ? (
        <Alert severity="success" title="Actualizada">
          {state.message}
        </Alert>
      ) : null}

      {canManage ? (
        <form action={action} className="mos-form" style={{ marginTop: 'var(--space-2)' }}>
          <label className="mos-field">
            <span>Especialidad</span>
            <select name="packId" defaultValue={activeId}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.description}
                </option>
              ))}
            </select>
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar especialidad'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
          Requiere permiso <code>organization.manage</code> para cambiarla.
        </p>
      )}
    </ClinicalCard>
  );
}
