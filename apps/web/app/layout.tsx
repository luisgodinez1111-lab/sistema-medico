import{headers}from"next/headers";
import{NonceProvider}from"../lib/nonce-context";
// Sin prerender ni caché de página: cada respuesta HTML lleva su propio nonce (S-04).
export const dynamic="force-dynamic";export const revalidate=0;
// Auditoría S-04: el layout raíz LEE el nonce que generó el middleware (cabecera x-nonce). Leer `headers()` hace las páginas
// dinámicas (se renderizan por petición): es la condición para que Next marque sus scripts en línea con el nonce de la CSP
// y ningún script sin nonce se ejecute. Las páginas viven detrás del login: no pierden nada al dejar de ser estáticas.
export default async function RootLayout({children}:{children:React.ReactNode}){
 const nonce=(await headers()).get("x-nonce")??undefined;
 return <html lang="es"><head>{nonce?<meta property="csp-nonce" content={nonce}/>:null}</head><body style={{margin:0,fontFamily:"Inter,system-ui,sans-serif",background:"#f7f7fb",color:"#17172a"}}><NonceProvider nonce={nonce}>{children}</NonceProvider></body></html>;
}
