'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import {
  orderStudyAction,
  enterResultAction,
  reviewResultAction,
  type AllergyActionState,
} from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface OrderView {
  id: string;
  code: string;
  category: string;
  priority: string;
  status: string;
}
export interface ReportView {
  id: string;
  code: string;
  value: string;
  abnormalFlag: 'normal' | 'low' | 'high' | 'critical';
  reviewStatus: string;
}

const FLAG_TONE: Record<string, 'success' | 'warning' | 'critical' | 'neutral'> = {
  normal: 'success',
  low: 'warning',
  high: 'warning',
  critical: 'critical',
};
const FLAG_LABEL: Record<string, string> = {
  normal: 'Normal',
  low: 'Bajo',
  high: 'Alto',
  critical: 'Crítico',
};

/**
 * Estudios y resultados del paciente (§NIVEL 9, closed-loop): solicitar estudio,
 * ingresar resultado y revisar (acción + paciente informado). Todo server-side
 * con permiso `patient.write`.
 */
export function OrdersManager({
  patientId,
  orders,
  reports,
  canWrite,
}: {
  patientId: string;
  orders: OrderView[];
  reports: ReportView[];
  canWrite: boolean;
}) {
  const [orderState, orderAction, ordering] = useActionState(orderStudyAction, INITIAL);
  const [resultState, resultAction, resulting] = useActionState(enterResultAction, INITIAL);
  const [reviewState, reviewAction, reviewing] = useActionState(reviewResultAction, INITIAL);

  const pendingOrders = orders.filter(
    (o) => o.status === 'requested' || o.status === 'in-progress',
  );

  return (
    <ClinicalCard title="Estudios y resultados">
      {/* Resultados */}
      {reports.length === 0 ? (
        <p className="mos-muted">Sin resultados registrados.</p>
      ) : (
        <ul className="mos-list">
          {reports.map((r) => (
            <li key={r.id} className="mos-list__item">
              <span>
                <strong>{r.code}</strong>: {r.value}
                {r.reviewStatus === 'pending' ? (
                  <>
                    <br />
                    {canWrite ? (
                      <form action={reviewAction} className="mos-inline-form">
                        <input type="hidden" name="patientId" value={patientId} />
                        <input type="hidden" name="reportId" value={r.id} />
                        <input name="action" placeholder="Acción tomada" required />
                        <label className="mos-field--inline">
                          <input type="checkbox" name="patientInformed" />{' '}
                          <span>Paciente informado</span>
                        </label>
                        <Button type="submit" variant="secondary" disabled={reviewing}>
                          Revisar
                        </Button>
                      </form>
                    ) : (
                      <span className="mos-muted">Pendiente de revisión</span>
                    )}
                  </>
                ) : (
                  <>
                    <br />
                    <span className="mos-muted">Revisado</span>
                  </>
                )}
              </span>
              <Badge tone={FLAG_TONE[r.abnormalFlag] ?? 'neutral'}>
                {FLAG_LABEL[r.abnormalFlag] ?? r.abnormalFlag}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {reviewState.status === 'ok' ? (
        <Alert severity="success" title="Closed-loop">
          {reviewState.message}
        </Alert>
      ) : reviewState.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {reviewState.message}
        </Alert>
      ) : null}

      {/* Órdenes pendientes: ingresar resultado (demo de laboratorio) */}
      {canWrite && pendingOrders.length > 0 ? (
        <>
          <p className="mos-section-label" style={{ marginTop: 'var(--space-4)' }}>
            Órdenes pendientes de resultado
          </p>
          {resultState.status === 'ok' ? (
            <Alert severity="success" title="Resultado">
              {resultState.message}
            </Alert>
          ) : null}
          <ul className="mos-list">
            {pendingOrders.map((o) => (
              <li key={o.id}>
                <form action={resultAction} className="mos-inline-form">
                  <input type="hidden" name="patientId" value={patientId} />
                  <input type="hidden" name="serviceRequestId" value={o.id} />
                  <input type="hidden" name="code" value={o.code} />
                  <span>
                    <strong>{o.code}</strong> <span className="mos-muted">({o.priority})</span>
                  </span>
                  <input name="value" placeholder="Resultado (p.ej. Hb 9.1)" required />
                  <select name="abnormalFlag" defaultValue="normal">
                    <option value="normal">Normal</option>
                    <option value="low">Bajo</option>
                    <option value="high">Alto</option>
                    <option value="critical">Crítico</option>
                  </select>
                  <Button type="submit" variant="secondary" disabled={resulting}>
                    Ingresar resultado
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Solicitar estudio */}
      {canWrite ? (
        <>
          {orderState.status === 'ok' ? (
            <Alert severity="success" title="Estudio">
              {orderState.message}
            </Alert>
          ) : orderState.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {orderState.message}
            </Alert>
          ) : null}
          <form action={orderAction} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <div className="mos-field-grid">
              <label className="mos-field">
                <span>Estudio</span>
                <input name="code" required placeholder="p.ej. Biometría hemática" />
              </label>
              <label className="mos-field">
                <span>Categoría</span>
                <select name="category" defaultValue="laboratory">
                  <option value="laboratory">Laboratorio</option>
                  <option value="imaging">Imagen</option>
                  <option value="procedure">Procedimiento</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Prioridad</span>
                <select name="priority" defaultValue="routine">
                  <option value="routine">Rutina</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
            </div>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={ordering}>
                {ordering ? 'Solicitando…' : 'Solicitar estudio'}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </ClinicalCard>
  );
}
