import { NextResponse } from 'next/server';
import { DocumentRepository, resolveStorageProvider, AuditRepository } from '@medical-os/db';
import type { DocumentId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

/**
 * Proxy de descarga autorizado (§R5, ADR-0003 §10). NO sirve los bytes: valida
 * sesión + tenant y redirige a una URL GET prefirmada de corta duración. El
 * documento debe estar `stored`; nunca se exponen URLs públicas ni la clave.
 * 404 cross-tenant (no revela existencia, §27). Registra el acceso (§NIVEL 10).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
): Promise<NextResponse> {
  const { docId } = await params;
  const ctx = await getRequestContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const repo = new DocumentRepository(db, ctx);
  const doc = await repo.findById(docId as DocumentId);
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (doc.status !== 'stored' || !doc.storageKey) {
    return NextResponse.json({ error: 'not_stored' }, { status: 409 });
  }

  const provider = resolveStorageProvider(process.env);
  if (!provider.configured) {
    return NextResponse.json({ error: 'storage_unconfigured' }, { status: 412 });
  }
  const target = provider.presignDownload(doc.storageKey);
  if (!target.ok) {
    return NextResponse.json({ error: 'presign_failed' }, { status: 500 });
  }

  await new AuditRepository(db, ctx).record({
    action: 'read',
    outcome: 'allowed',
    resourceType: 'clinical-document',
    resourceId: doc.id,
    patientId: doc.patientId,
    payload: { phase: 'download-presign', provider: provider.provider },
  });

  return NextResponse.redirect(target.value.url, {
    status: 302,
    headers: { 'cache-control': 'private, no-store' },
  });
}
