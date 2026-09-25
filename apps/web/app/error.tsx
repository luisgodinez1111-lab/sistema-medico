"use client";
// Límite de errores de los demás segmentos (portada y login). Mismo cuerpo que el del workspace: ver `./screen-error`.
import{ScreenError,type PantallaError}from"./screen-error";
export default function RootSegmentError({error,reset}:{error:PantallaError;reset:()=>void}){
 return <ScreenError error={error} reset={reset} scope="app"/>;
}
