'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@medical-os/design-system';
import { requestUploadTarget, finalizeDocument } from './actions';

/** SHA-256 hex del archivo, calculado en el navegador (integridad, §33 #5). */
async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sube el archivo de un documento pendiente directamente al object storage
 * privado mediante una URL PUT prefirmada; los bytes NO pasan por el servidor.
 * Tras subir, sella el documento con su hash de integridad.
 */
export function DocumentUploader({ documentId }: { documentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const target = await requestUploadTarget(documentId);
      if (!target.ok || !target.url) {
        setError(target.message ?? 'No se pudo iniciar la subida.');
        return;
      }
      const put = await fetch(target.url, { method: 'PUT', body: file });
      if (!put.ok) {
        setError(`Fallo al subir el archivo (HTTP ${put.status}).`);
        return;
      }
      const hash = await sha256Hex(file);
      const sealed = await finalizeDocument(documentId, hash, file.size);
      if (sealed.status !== 'ok') {
        setError(sealed.message ?? 'No se pudo sellar el documento.');
        return;
      }
      router.refresh();
    } catch {
      setError('Error inesperado durante la subida.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Subiendo…' : 'Subir archivo'}
      </Button>
      {error ? (
        <span
          className="mos-muted"
          style={{ color: 'var(--color-danger)', marginLeft: 'var(--space-2)' }}
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
