import { ClinicalCard, Badge, Alert } from '@medical-os/design-system';
import {
  OrganizationRepository,
  FacilityRepository,
  SpecialtyRepository,
  hasPermission,
  listSpecialtyPacks,
  DEFAULT_SPECIALTY_PACK_ID,
} from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { SpecialtySelector } from './SpecialtySelector';

/**
 * Organización y consultorios del tenant — PRIMEROS datos reales desde Neon
 * (§NIVEL 2). Todo se resuelve server-side con el TenantContext y se lee a
 * través de repositories tenant-aware (scoping obligatorio).
 */
export const dynamic = 'force-dynamic'; // depende de datos de sesión/BD

export default async function OrgPage() {
  const ctx = await getRequestContext();

  if (!ctx) {
    return (
      <div className="mos-page">
        <h1 className="mos-page__title">Organización</h1>
        <Alert severity="critical" title="Sin contexto de tenant">
          No hay una membresía activa resuelta en el servidor. Ejecuta el seed (`pnpm --filter
          @medical-os/db db:seed`) y verifica las variables del entorno.
        </Alert>
      </div>
    );
  }

  const db = getDb();
  const orgs = await new OrganizationRepository(db, ctx).list();
  const facilityRepo = new FacilityRepository(db, ctx);

  const orgsWithFacilities = await Promise.all(
    orgs.map(async (o) => ({
      org: o,
      facilities: await facilityRepo.listByOrganization(o.id),
    })),
  );

  const activePackId =
    (await new SpecialtyRepository(db, ctx).getActivePackId()) ?? DEFAULT_SPECIALTY_PACK_ID;
  const packOptions = listSpecialtyPacks().map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
  const canManage = hasPermission(ctx, 'organization.manage');

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Organización</h1>
      <p className="mos-page__subtitle">Datos reales desde Neon · tenant-scoped (NIVEL 2)</p>

      <Alert severity="success" title="Conectado a la base de datos">
        Lectura server-side vía repositories tenant-aware. Permiso `organization.manage`:{' '}
        {hasPermission(ctx, 'organization.manage') ? 'sí' : 'no'}.
      </Alert>

      <div style={{ height: 'var(--space-4)' }} />

      <SpecialtySelector options={packOptions} activeId={activePackId} canManage={canManage} />

      <div style={{ height: 'var(--space-4)' }} />

      {orgsWithFacilities.length === 0 ? (
        <Alert severity="info" title="Sin organizaciones">
          El tenant no tiene organizaciones. Corre el seed para crear datos de demo.
        </Alert>
      ) : (
        <div className="mos-grid">
          {orgsWithFacilities.map(({ org, facilities }) => (
            <ClinicalCard key={org.id} title={org.name}>
              <ul className="mos-list">
                {facilities.length === 0 ? (
                  <li className="mos-muted">Sin consultorios</li>
                ) : (
                  facilities.map((f) => (
                    <li key={f.id} className="mos-list__item">
                      <span>
                        <strong>{f.name}</strong>
                        <br />
                        <span className="mos-muted">{f.timezone}</span>
                      </span>
                      <Badge tone={f.status === 'active' ? 'success' : 'neutral'}>
                        {f.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </li>
                  ))
                )}
              </ul>
            </ClinicalCard>
          ))}
        </div>
      )}
    </div>
  );
}
