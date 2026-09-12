import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Medical OS',
  description: 'Clinical Operating System — SaaS multi-tenant, México-first',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b6ef3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="mos-app">
          <header className="mos-topbar">
            <Link href="/" className="mos-topbar__brand">
              Medical OS
            </Link>
            <nav className="mos-topbar__nav" aria-label="Navegación principal">
              <Link className="mos-topbar__link" href="/">
                Inicio
              </Link>
              <Link className="mos-topbar__link" href="/patients">
                Pacientes
              </Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
