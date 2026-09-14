import { NextResponse } from 'next/server';
import { pingDatabase } from '@medical-os/db';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

/**
 * Health check (§NIVEL 17 SRE). Ruta PÚBLICA para monitoreo de disponibilidad
 * (uptime, load balancer). Comprueba conectividad con la BD y responde 200 si todo
 * está sano, 503 si la BD no responde. NO expone PHI ni detalles internos.
 */
export async function GET() {
  const startedAt = Date.now();
  let dbUp: boolean;
  try {
    dbUp = await pingDatabase(getDb());
  } catch {
    dbUp = false;
  }
  const body = {
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    latencyMs: Date.now() - startedAt,
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    status: dbUp ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
