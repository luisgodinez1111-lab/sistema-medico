// Destino tras autenticar: se respeta ?next= (deep-link del expediente, p. ej. /workspace?v=exp&p=…&s=resumen) pero SOLO si
// es una ruta interna segura —empieza con "/" y no con "//" ni "/\" (evita el open-redirect a otro origen)—; cualquier otra
// cosa (externa, vacía o malformada) cae al workspace. El middleware mete la ruta completa en ?next= y el login la respeta
// a través del appState de Auth0; sin esta validación, un ?next=//evil.com tras el login sería una redirección abierta.
export const DEFAULT_NEXT="/workspace";
export function safeNext(raw:string|null|undefined):string{
 if(!raw)return DEFAULT_NEXT;
 let v=raw;try{v=decodeURIComponent(raw);}catch{/* ya venía sin codificar */}
 if(!v.startsWith("/")||v.startsWith("//")||v.startsWith("/\\"))return DEFAULT_NEXT;
 return v;
}
