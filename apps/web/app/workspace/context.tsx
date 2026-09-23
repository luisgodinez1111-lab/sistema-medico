"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09). Contexto del workspace: el modelo (hooks + handlers) y los
// derivados del encabezado, disponibles para cada vista. Solo se monta la vista activa; cada una toma lo que usa.
import{createContext,useContext}from"react";
import type{WorkspaceBag}from"./model";
const Ctx=createContext<WorkspaceBag|null>(null);
export function WorkspaceProvider({value,children}:{value:WorkspaceBag;children:React.ReactNode}){return <Ctx.Provider value={value}>{children}</Ctx.Provider>;}
export function useWorkspace():WorkspaceBag{const v=useContext(Ctx);if(!v)throw new Error("useWorkspace fuera de WorkspaceProvider");return v;}
