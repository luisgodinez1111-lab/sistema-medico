'use client';

import { Button } from '@medical-os/design-system';

/** Botón que abre el diálogo de impresión del navegador (→ PDF). */
export function PrintButton() {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()}>
      Imprimir / Guardar PDF
    </Button>
  );
}
