'use client';

import { useState, useTransition } from 'react';
import { Button, Badge } from '@medical-os/design-system';
import { orderFromSpecialtyAction } from './actions';

interface OrderSetItem {
  code: string;
  label: string;
}

/**
 * Order sets del pack de especialidad (§R7) accionables en UN CLIC. Cada botón
 * crea una ServiceRequest vía server action (validada contra el pack activo). El
 * clínico decide; nada se crea sin su clic. Contenido DEMO.
 */
export function OrderSetActions({
  patientId,
  items,
}: {
  patientId: string;
  items: ReadonlyArray<OrderSetItem>;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function request(code: string): void {
    setBusy(code);
    startTransition(async () => {
      const res = await orderFromSpecialtyAction(patientId, code);
      setDone((prev) => ({ ...prev, [code]: res.ok ? 'ok' : res.message }));
      setBusy(null);
    });
  }

  return (
    <ul className="mos-list">
      {items.map((o) => {
        const state = done[o.code];
        return (
          <li key={o.code} className="mos-list__item">
            <span>{o.label}</span>
            {state === 'ok' ? (
              <Badge tone="success">Solicitada ✓</Badge>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending && busy === o.code}
                onClick={() => request(o.code)}
                title={state && state !== 'ok' ? state : `Solicitar: ${o.label}`}
              >
                {pending && busy === o.code ? 'Solicitando…' : 'Solicitar'}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
