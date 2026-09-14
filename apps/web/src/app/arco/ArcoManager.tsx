'use client';

import { useActionState, useState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import {
  createArcoAction,
  markArcoInReviewAction,
  resolveArcoAction,
  type ArcoState,
} from './actions';

const INITIAL: ArcoState = { status: 'idle' };

export interface ArcoView {
  id: string;
  type: string;
  status: string;
  requesterName: string;
  requesterRelation: string;
  requesterContact: string | null;
  detail: string | null;
  patientId: string | null;
  dueDate: string;
  receivedAt: string;
  outcome: string | null;
  resolution: string | null;
  resolvedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  access: 'Acceso',
  rectification: 'Rectificación',
  cancellation: 'Cancelación',
  opposition: 'Oposición',
};
const STATUS_LABEL: Record<string, string> = {
  received: 'Recibida',
  'in-review': 'En revisión',
  completed: 'Atendida',
  rejected: 'Rechazada',
};
const OUTCOME_LABEL: Record<string, string> = {
  granted: 'Procedente',
  'partially-granted': 'Parcial',
  denied: 'Improcedente',
};

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'completed' || status === 'rejected') return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function ArcoManager({ requests }: { requests: ArcoView[] }) {
  const open = requests.filter((r) => r.status === 'received' || r.status === 'in-review');
  const closed = requests.filter((r) => r.status === 'completed' || r.status === 'rejected');

  const [createState, createAction, creating] = useActionState(createArcoAction, INITIAL);

  return (
    <>
      <ClinicalCard title={`Solicitudes abiertas (${open.length})`}>
        {open.length === 0 ? (
          <p className="mos-muted">Sin solicitudes abiertas.</p>
        ) : (
          <ul className="mos-list">
            {open.map((r) => (
              <ArcoRow key={r.id} req={r} />
            ))}
          </ul>
        )}
      </ClinicalCard>

      <div style={{ height: 'var(--space-4)' }} />

      <ClinicalCard title="Registrar solicitud">
        {createState.status !== 'idle' ? (
          <Alert
            severity={createState.status === 'ok' ? 'success' : 'critical'}
            title="Solicitud ARCO"
          >
            {createState.message}
          </Alert>
        ) : null}
        <form action={createAction} className="mos-form">
          <label className="mos-field">
            <span>Tipo de derecho</span>
            <select name="type" defaultValue="access">
              <option value="access">Acceso</option>
              <option value="rectification">Rectificación</option>
              <option value="cancellation">Cancelación</option>
              <option value="opposition">Oposición</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Solicitante</span>
            <input name="requesterName" type="text" placeholder="Nombre de quien solicita" />
          </label>
          <label className="mos-field">
            <span>Relación con el titular</span>
            <select name="requesterRelation" defaultValue="self">
              <option value="self">El propio titular</option>
              <option value="representative">Representante / tutor</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Contacto (opcional)</span>
            <input name="requesterContact" type="text" placeholder="Email o teléfono" />
          </label>
          <label className="mos-field">
            <span>MRN del expediente (opcional)</span>
            <input name="mrn" type="text" placeholder="Liga la solicitud al titular" />
          </label>
          <label className="mos-field">
            <span>Detalle de lo solicitado</span>
            <textarea name="detail" rows={2} placeholder="Qué dato, qué corrección…" />
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Registrando…' : 'Registrar solicitud'}
            </Button>
          </div>
        </form>
      </ClinicalCard>

      {closed.length > 0 ? (
        <>
          <div style={{ height: 'var(--space-4)' }} />
          <ClinicalCard title={`Historial (${closed.length})`}>
            <ul className="mos-list">
              {closed.map((r) => (
                <li key={r.id} className="mos-list__item">
                  <span>
                    <strong>{TYPE_LABEL[r.type] ?? r.type}</strong> · {r.requesterName}
                    <br />
                    <span className="mos-muted">
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.outcome ? ` · ${OUTCOME_LABEL[r.outcome] ?? r.outcome}` : ''}
                      {r.resolvedAt ? ` · ${r.resolvedAt.slice(0, 10)}` : ''}
                      {r.resolution ? ` — ${r.resolution}` : ''}
                    </span>
                  </span>
                  <Badge tone={r.status === 'completed' ? 'success' : 'neutral'}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </ClinicalCard>
        </>
      ) : null}
    </>
  );
}

function ArcoRow({ req }: { req: ArcoView }) {
  const [reviewState, reviewAction, reviewing] = useActionState(markArcoInReviewAction, INITIAL);
  const [resolveState, resolveAction, resolving] = useActionState(resolveArcoAction, INITIAL);
  const [showResolve, setShowResolve] = useState(false);
  const overdue = isOverdue(req.dueDate, req.status);

  return (
    <li className="mos-list__item" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      <span style={{ flex: '1 1 260px' }}>
        <strong>{TYPE_LABEL[req.type] ?? req.type}</strong> · {req.requesterName}
        {req.requesterRelation === 'representative' ? ' (representante)' : ''}
        <br />
        <span className="mos-muted">
          recibida {req.receivedAt.slice(0, 10)} · vence {req.dueDate}
          {req.requesterContact ? ` · ${req.requesterContact}` : ''}
          {req.detail ? ` · ${req.detail}` : ''}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {overdue ? <Badge tone="critical">Plazo vencido</Badge> : null}
        <Badge tone={req.status === 'in-review' ? 'warning' : 'neutral'}>
          {STATUS_LABEL[req.status] ?? req.status}
        </Badge>
        {req.status === 'received' ? (
          <form action={reviewAction}>
            <input type="hidden" name="id" value={req.id} />
            <Button type="submit" variant="ghost" disabled={reviewing}>
              En revisión
            </Button>
          </form>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => setShowResolve((v) => !v)}>
          Resolver
        </Button>
      </span>

      {reviewState.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {reviewState.message}
        </Alert>
      ) : null}

      {showResolve ? (
        <form action={resolveAction} className="mos-form" style={{ flex: '1 1 100%' }}>
          <input type="hidden" name="id" value={req.id} />
          {resolveState.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {resolveState.message}
            </Alert>
          ) : null}
          <label className="mos-field">
            <span>Desenlace</span>
            <select name="outcome" defaultValue="granted">
              <option value="granted">Procedente</option>
              <option value="partially-granted">Parcialmente procedente</option>
              <option value="denied">Improcedente</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Resolución (fundamento y acción tomada)</span>
            <textarea name="resolution" rows={2} required />
          </label>
          <label className="mos-checkbox">
            <input type="checkbox" name="reject" value="1" /> Marcar como rechazada (improcedente)
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="primary" disabled={resolving}>
              {resolving ? 'Guardando…' : 'Cerrar solicitud'}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
