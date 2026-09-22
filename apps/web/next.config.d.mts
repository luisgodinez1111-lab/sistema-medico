// Tipos de apps/web/next.config.mjs (el config es JS porque Next lo carga tal cual; los tests sí pasan por el typecheck estricto).
import type{NextConfig}from"next";
type Env=Readonly<Record<string,string|undefined>>;
export type HeaderPair=Readonly<{key:string;value:string}>;
export function auth0Origin(env?:Env):string;
export function contentSecurityPolicy(env?:Env):string;
export function securityHeaders(env?:Env):HeaderPair[];
export const API_NO_STORE:readonly HeaderPair[];
declare const nextConfig:NextConfig;
export default nextConfig;
