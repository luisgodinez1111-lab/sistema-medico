// Auditoría 2026-09-19, anexo R05c (R05c-27) — EL MENSAJE DE ERROR NO LO ESCRIBE QUIEN MANDA EL ENLACE.
//
// El parámetro `error_description` de la URL se pintaba tal cual, con el estilo de la propia aplicación. React escapa el
// HTML, así que no había XSS, pero sí suplantación de mensaje: un enlace a
// `/login?error=x&error_description=Su sesión expiró, llame al 55-…` mostraba ese texto como si fuera del sistema, en la
// pantalla donde el usuario está a punto de poner sus credenciales. Los CÓDIGOS del proveedor son un conjunto conocido y
// corto; el texto libre que los acompaña no se muestra nunca.
const ERRORES:Readonly<Record<string,string>>={
 access_denied:"El proveedor de identidad denegó el acceso. Si cree que es un error, contacte al administrador del consultorio.",
 unauthorized:"Esta cuenta no tiene acceso al sistema. Contacte al administrador del consultorio.",
 login_required:"La sesión expiró. Vuelva a entrar.",
 consent_required:"Falta autorizar el acceso de esta aplicación en el proveedor de identidad.",
 interaction_required:"El proveedor de identidad pide completar un paso adicional. Vuelva a intentar entrar.",
 invalid_request:"La solicitud de inicio de sesión no es válida. Vuelva a entrar desde la página de inicio.",
 server_error:"El proveedor de identidad tuvo un error. Intente de nuevo en unos minutos.",
 temporarily_unavailable:"El proveedor de identidad no está disponible. Intente de nuevo en unos minutos.",
};
/** Mensaje propio para un código de error del proveedor. Nunca se muestra el texto que venga en la URL. */
export function mensajeDeError(code:string):string{
 const c=code.trim().toLowerCase().replace(/[^a-z_]/g,"").slice(0,40);
 return ERRORES[c]??`No se pudo iniciar sesión (código «${c||"desconocido"}»). Intente de nuevo; si persiste, contacte al administrador del consultorio.`;
}
