// Nombre de la cookie de sesión, en un módulo SIN dependencias de Node para que el middleware pueda importarlo.
// `apps/web/lib/http-command.ts` lo reexporta; tests/v22/rate-limit.test.ts comprueba que ambos coinciden.
export const SESSION_COOKIE="medos_session";
