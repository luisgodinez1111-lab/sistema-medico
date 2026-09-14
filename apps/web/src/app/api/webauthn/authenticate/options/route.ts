import { NextResponse, type NextRequest } from 'next/server';
import { resolveRp, buildAuthenticationOptions } from '@medical-os/db';

export const dynamic = 'force-dynamic';

/**
 * Opciones de AUTENTICACIÓN con passkey (§NIVEL 2/15). Ruta PÚBLICA (pre-sesión):
 * el proxy la exceptúa. Flujo sin usuario (passkey descubrible): no revela qué
 * credenciales existen. Guarda el challenge en una cookie httpOnly de corta vida;
 * el provider `passkey` la lee para verificar la aserción.
 */
export async function GET(request: NextRequest) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
  const rp = resolveRp(host);

  const options = await buildAuthenticationOptions({ rp });

  const res = NextResponse.json(options);
  res.cookies.set('wa_chal', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 min: un solo intento de login; se sobreescribe en cada petición
  });
  return res;
}
