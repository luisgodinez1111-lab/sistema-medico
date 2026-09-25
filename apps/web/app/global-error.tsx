"use client";
// Última red: un fallo en el propio layout raíz no lo atrapa ningún `error.tsx` de segmento, porque el layout está POR ENCIMA
// de ellos. `global-error.tsx` sustituye al layout completo, así que tiene que traer su propio <html> y <body> (requisito de
// Next.js App Router, no una elección). Ver el hallazgo en `./screen-error`.
import{ScreenError,type PantallaError}from"./screen-error";
export default function GlobalError({error,reset}:{error:PantallaError;reset:()=>void}){
 return <html lang="es"><body style={{margin:0}}><ScreenError error={error} reset={reset} scope="root-layout"/></body></html>;
}
