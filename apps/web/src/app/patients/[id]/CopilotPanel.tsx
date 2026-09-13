'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { generateCopilotAction, type CopilotState } from './actions';

const INITIAL: CopilotState = { status: 'idle' };

/**
 * Copiloto clínico (§R6) — human-in-the-loop. Muestra sugerencias del asistente
 * (motor DEMO, no IA); el clínico decide. No escribe nada al expediente: cada
 * sugerencia es informativa y se acciona con los flujos permisados existentes.
 */
export function CopilotPanel({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(generateCopilotAction, INITIAL);

  return (
    <ClinicalCard title="Copiloto clínico (asistente)">
      <p className="mos-muted">
        El asistente SUGIERE; tú decides. No modifica el expediente. Motor actual:{' '}
        <strong>DEMO (no IA)</strong>.
      </p>

      {state.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {state.message}
        </Alert>
      ) : null}

      {state.status === 'ok' ? (
        state.suggestions && state.suggestions.length > 0 ? (
          <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
            {state.suggestions.map((s) => (
              <li key={s.code} className="mos-list__item">
                <span>
                  <strong>{s.title}</strong>
                  <br />
                  <span className="mos-muted">{s.detail}</span>
                </span>
                <Badge tone={s.severity === 'warning' ? 'warning' : 'info'}>
                  {s.severity === 'warning' ? 'Revisar' : 'Sugerencia'}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
            Sin sugerencias para el contexto actual.
          </p>
        )
      ) : null}

      <form action={action} className="mos-form__actions" style={{ marginTop: 'var(--space-3)' }}>
        <input type="hidden" name="patientId" value={patientId} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Generando…' : 'Generar sugerencias'}
        </Button>
      </form>
    </ClinicalCard>
  );
}
