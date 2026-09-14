import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from './LoginForm';
import { PasskeyLoginButton } from './PasskeyLoginButton';

export const dynamic = 'force-dynamic';

/** Página de acceso. Si ya hay sesión, va directo al Command Center. */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <div className="mos-page" style={{ maxWidth: 420 }}>
      <h1 className="mos-page__title">Medical OS</h1>
      <p className="mos-page__subtitle">Inicia sesión para continuar</p>
      <LoginForm />
      <PasskeyLoginButton />
    </div>
  );
}
