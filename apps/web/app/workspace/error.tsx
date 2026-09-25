"use client";
// Límite de errores del WORKSPACE (auditoría R05a/R05b, lote 15). El cuerpo está en `../screen-error`; ver allí el hallazgo.
// Este segmento es el que importa: es el árbol de cliente grande —el expediente— y el único donde una excepción de render
// dejaba al médico ante una pantalla en blanco.
import{ScreenError,type PantallaError}from"../screen-error";
export default function WorkspaceError({error,reset}:{error:PantallaError;reset:()=>void}){
 return <ScreenError error={error} reset={reset} scope="workspace"/>;
}
