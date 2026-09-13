import { logoutAction } from './login/actions';
import { Button } from '@medical-os/design-system';

/** Botón de cierre de sesión (form → server action). */
export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" title={`Cerrar sesión (${label})`}>
        Salir
      </Button>
    </form>
  );
}
