'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { createPatientAction, type CreatePatientState } from './actions';

const INITIAL: CreatePatientState = { status: 'idle' };

/**
 * Formulario de alta de paciente con flujo de duplicados (§NIVEL 3).
 * Si la server action detecta coincidencias, muestra los candidatos y habilita
 * "Crear de todas formas" (reenvía con confirm=1). La creación y la
 * autorización ocurren en el servidor.
 */
export function NewPatientForm() {
  const [state, formAction, pending] = useActionState(createPatientAction, INITIAL);
  const v = state.values ?? {};
  const hasDuplicates = state.status === 'duplicates';

  return (
    <ClinicalCard title="Nuevo paciente">
      <form action={formAction} className="mos-form">
        {state.status === 'error' && state.message ? (
          <Alert severity="critical" title="No se pudo crear">
            {state.message}
          </Alert>
        ) : null}

        {hasDuplicates ? (
          <Alert severity="warning" title="Posibles duplicados">
            {state.message}
            <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
              {state.duplicates!.map((d) => (
                <li key={d.id} className="mos-list__item">
                  <span>
                    <strong>{d.fullName}</strong> · MRN {d.mrn} · {d.birthDate}
                  </span>
                  <Badge tone={d.reason === 'curp' ? 'critical' : 'warning'}>
                    {d.reason === 'curp' ? 'CURP idéntica' : 'Nombre y fecha'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="mos-field-grid">
          <label className="mos-field">
            <span>Nombre(s)</span>
            <input name="givenNames" defaultValue={v.givenNames ?? ''} required />
            {state.fieldErrors?.givenNames ? (
              <span className="mos-field__error">{state.fieldErrors.givenNames}</span>
            ) : null}
          </label>
          <label className="mos-field">
            <span>Apellido paterno</span>
            <input name="firstSurname" defaultValue={v.firstSurname ?? ''} required />
            {state.fieldErrors?.firstSurname ? (
              <span className="mos-field__error">{state.fieldErrors.firstSurname}</span>
            ) : null}
          </label>
          <label className="mos-field">
            <span>Apellido materno</span>
            <input name="secondSurname" defaultValue={v.secondSurname ?? ''} />
          </label>
          <label className="mos-field">
            <span>Fecha de nacimiento</span>
            <input name="birthDate" type="date" defaultValue={v.birthDate ?? ''} required />
            {state.fieldErrors?.birthDate ? (
              <span className="mos-field__error">{state.fieldErrors.birthDate}</span>
            ) : null}
          </label>
          <label className="mos-field">
            <span>Sexo</span>
            <select name="sex" defaultValue={v.sex ?? 'unknown'}>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
              <option value="unknown">No especificado</option>
            </select>
          </label>
          <label className="mos-field">
            <span>CURP (opcional)</span>
            <input name="curp" defaultValue={v.curp ?? ''} maxLength={18} />
          </label>
        </div>

        {/* confirm=1 sólo cuando el usuario decide crear pese a los duplicados. */}
        <input type="hidden" name="confirm" value={hasDuplicates ? '1' : '0'} />

        <div className="mos-form__actions">
          <Button
            type="submit"
            variant={hasDuplicates ? 'secondary' : 'primary'}
            disabled={pending}
          >
            {pending ? 'Guardando…' : hasDuplicates ? 'Crear de todas formas' : 'Crear paciente'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
