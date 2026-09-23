"use client";
// Auditoría S-04 — el nonce de la CSP de ESTA petición, disponible en los componentes cliente durante el SSR y la hidratación.
// El layout raíz (servidor) lo lee de la cabecera que puso el middleware y lo provee aquí; los elementos <style> propios lo
// declaran (`<style nonce={useNonce()}>`), con lo que `style-src-elem` puede exigir nonce sin romper la UI.
import{createContext,useContext}from"react";
const NonceContext=createContext<string|undefined>(undefined);
export function NonceProvider({nonce,children}:{nonce:string|undefined;children:React.ReactNode}){return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;}
export function useNonce():string|undefined{return useContext(NonceContext);}
