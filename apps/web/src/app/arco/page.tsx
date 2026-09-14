import { redirect } from 'next/navigation';
import { ClinicalCard, Alert } from '@medical-os/design-system';
import { ArcoRepository, hasPermission } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { ArcoManager, type ArcoView } from './ArcoManager';

export const dynamic = 'force-dynamic';

/**
 * Bandeja de solicitudes ARCO (§NIVEL 18, LFPDPPP): Acceso, Rectificación,
 * Cancelación y Oposición. Cada solicitud tiene plazo legal (20 días hábiles) y se
 * cierra con resolución atribuida. Requiere permiso `privacy.manage`.
 */
export default async function ArcoPage() {
  const ctx = await getRequestContext();
  if (!ctx) redirect('/login');

  if (!hasPermission(ctx, 'privacy.manage')) {
    return (
      <div className="mos-page" style={{ maxWidth: 720 }}>
        <h1 className="mos-page__title">Solicitudes ARCO</h1>
        <Alert severity="critical" title="Sin permiso">
          Necesitas el permiso <code>privacy.manage</code> para gestionar solicitudes de derechos
          ARCO. Solicítalo a un administrador del tenant.
        </Alert>
      </div>
    );
  }

  const rows = await new ArcoRepository(getDb(), ctx).list(200);
  const toIso = (d: Date | string | null): string | null =>
    d ? (d instanceof Date ? d.toISOString() : String(d)) : null;

  const views: ArcoView[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    requesterName: r.requesterName,
    requesterRelation: r.requesterRelation,
    requesterContact: r.requesterContact,
    detail: r.detail,
    patientId: r.patientId,
    dueDate: r.dueDate,
    receivedAt: toIso(r.receivedAt)!,
    outcome: r.outcome,
    resolution: r.resolution,
    resolvedAt: toIso(r.resolvedAt),
  }));

  return (
    <div className="mos-page" style={{ maxWidth: 860 }}>
      <h1 className="mos-page__title">Solicitudes ARCO</h1>
      <p className="mos-page__subtitle">
        Derechos del titular (LFPDPPP) · plazo legal de respuesta: 20 días hábiles
      </p>
      <ClinicalCard title="Acerca de ARCO">
        <p className="mos-muted">
          Acceso, Rectificación, Cancelación y Oposición. Registra la solicitud, verifica la
          identidad del titular o su representante fuera de línea, y cierra con una resolución
          fechada y atribuida. El histórico no se borra (cumplimiento verificable).
        </p>
      </ClinicalCard>
      <div style={{ height: 'var(--space-4)' }} />
      <ArcoManager requests={views} />
    </div>
  );
}
