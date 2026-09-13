'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { createInvoiceAction, type BillingActionState } from './actions';

const INITIAL: BillingActionState = { status: 'idle' };

/** Alta de factura básica (una línea) (R3). */
export function NewInvoiceForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createInvoiceAction, INITIAL);
  return (
    <ClinicalCard title="Nueva factura">
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo crear">
          {state.message}
        </Alert>
      ) : state.status === 'ok' ? (
        <Alert severity="success" title="Creada">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="mos-form">
        <input type="hidden" name="patientId" value={patientId} />
        <div className="mos-field-grid">
          <label className="mos-field">
            <span>Concepto</span>
            <input name="description" required placeholder="p.ej. Consulta" />
          </label>
          <label className="mos-field">
            <span>Cantidad</span>
            <input name="quantity" type="number" min={1} defaultValue={1} />
          </label>
          <label className="mos-field">
            <span>Precio unitario (MXN)</span>
            <input name="unitPrice" placeholder="p.ej. 800.00" inputMode="decimal" required />
          </label>
        </div>
        <div className="mos-form__actions">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Creando…' : 'Crear factura'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
