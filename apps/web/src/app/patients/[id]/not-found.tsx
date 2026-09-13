import Link from 'next/link';
import { Alert, Button } from '@medical-os/design-system';

/**
 * Paciente no encontrado. También cubre el intento de acceder a un paciente de
 * OTRO tenant: el repositorio devuelve null y nunca revela su existencia (§27,
 * ADR-0002). No se distingue "no existe" de "no autorizado".
 */
export default function PatientNotFound() {
  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Paciente no encontrado</h1>
      <Alert severity="warning" title="Sin acceso a este expediente">
        El paciente no existe o no pertenece a tu organización.
      </Alert>
      <div style={{ height: 'var(--space-4)' }} />
      <Link href="/patients">
        <Button variant="primary">Volver a Pacientes</Button>
      </Link>
    </div>
  );
}
