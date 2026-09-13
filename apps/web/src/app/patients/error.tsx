'use client';

import { useEffect } from 'react';
import { Alert, Button } from '@medical-os/design-system';

/**
 * Error boundary de la sección Pacientes (DoD §31: estado error explícito).
 * No muestra PHI ni detalles internos al usuario (§17, §33); el `digest` de
 * Next correlaciona con los logs del servidor sin exponer el mensaje.
 */
export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // La traza real queda en el servidor; aquí solo registramos que ocurrió.
    console.error('Error en sección Pacientes', error.digest ?? '');
  }, [error]);

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Algo salió mal</h1>
      <Alert severity="critical" title="No se pudo cargar la información">
        Ocurrió un error al procesar la solicitud. Intenta de nuevo; si persiste, reporta el
        incidente{error.digest ? ` (ref: ${error.digest})` : ''}.
      </Alert>
      <div style={{ height: 'var(--space-4)' }} />
      <Button variant="primary" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
