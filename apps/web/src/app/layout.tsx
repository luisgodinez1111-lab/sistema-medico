import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { CommandPalette } from './CommandPalette';
import { LogoutButton } from './LogoutButton';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'Medical OS',
  description: 'Clinical Operating System — SaaS multi-tenant, México-first',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b6ef3',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as
    { id?: string; name?: string | null; email?: string | null } | undefined;
  const isAuthed = Boolean(user?.id);

  return (
    <html lang="es">
      <body>
        <div className="mos-app">
          <header className="mos-topbar">
            <Link href="/" className="mos-topbar__brand">
              Medical OS
            </Link>
            {isAuthed ? (
              <nav className="mos-topbar__nav" aria-label="Navegación principal">
                <Link className="mos-topbar__link" href="/">
                  Inicio
                </Link>
                <Link className="mos-topbar__link" href="/patients">
                  Pacientes
                </Link>
                <Link className="mos-topbar__link" href="/agenda">
                  Agenda
                </Link>
              </nav>
            ) : null}
            <span className="mos-topbar__spacer" />
            {isAuthed ? (
              <>
                <kbd className="mos-kbd-hint" aria-hidden="true">
                  ⌘K
                </kbd>
                <span className="mos-topbar__user">{user?.name ?? user?.email}</span>
                <LogoutButton label={user?.email ?? ''} />
              </>
            ) : null}
          </header>
          <main>{children}</main>
          {isAuthed ? <CommandPalette /> : null}
        </div>
      </body>
    </html>
  );
}
