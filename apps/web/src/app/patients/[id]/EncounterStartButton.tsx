'use client';

import { useActionState } from 'react';
import { Button } from '@medical-os/design-system';
import { startEncounterAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

/** Botón "Iniciar consulta" del PatientHeader (§NIVEL 6). Crea un borrador. */
export function EncounterStartButton({ patientId }: { patientId: string }) {
  const [, action, pending] = useActionState(startEncounterAction, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Iniciando…' : 'Iniciar consulta'}
      </Button>
    </form>
  );
}
