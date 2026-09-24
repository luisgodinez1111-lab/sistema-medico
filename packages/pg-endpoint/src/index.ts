// Auditoría 2026-09-19, anexo R01 (R01-004): la cadena de conexión se manipulaba con tres `replace()` encadenados
// copiados en 12 ficheros (la app y 11 scripts). El regex producía una URL malformada cuando `channel_binding` no era el
// último parámetro —`...?channel_binding=require&sslmode=require` → `...?&sslmode=require`— y no había una sola fuente
// de verdad. Este módulo hace la transformación con `URL`, sin regex, y es el único sitio donde se decide.
//
// Por qué la transformación: en Neon el endpoint con `-pooler` es PgBouncer en modo transacción y NO admite parámetros
// de startup personalizados. El runtime fija el rol NOBYPASSRLS con `-c role=medical_os_runtime` en el startup de cada
// conexión (así RLS aplica a todo el pool), de modo que app y scripts deben hablar con el endpoint DIRECTO.
// `channel_binding=require` es incompatible con ese endpoint directo cuando la librería no negocia SCRAM con binding.

/** Endpoint DIRECTO (sin pooler y sin channel_binding) a partir de una cadena de conexión de Postgres/Neon. */
export function directEndpoint(raw: string): string {
  const value = raw.trim();
  if (value === "") throw new Error("DATABASE_URL vacía");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Cadena en formato clave=valor (libpq) u otra forma no-URL: se devuelve intacta en vez de corromperla.
    return value;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return value;
  url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.delete("channel_binding");
  // `URL` deja un "?" colgando cuando no queda ningún parámetro.
  const out = url.toString();
  return out.endsWith("?") ? out.slice(0, -1) : out;
}

/** Host y base de datos de una cadena de conexión, para poder registrar a QUÉ base se apunta sin exponer credenciales. */
export function describeEndpoint(raw: string): Readonly<{ host: string; database: string }> {
  try {
    const url = new URL(raw.trim());
    return { host: url.hostname, database: url.pathname.replace(/^\//, "") };
  } catch {
    return { host: "(desconocido)", database: "(desconocida)" };
  }
}
