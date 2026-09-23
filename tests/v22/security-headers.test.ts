import{describe,it,expect}from"vitest";
import nextConfig,{auth0Origin,contentSecurityPolicy,securityHeaders,API_NO_STORE}from"../../apps/web/next.config.mjs";
// Auditoría 2026-09-19 (S-04) — toda respuesta lleva cabeceras de seguridad y toda respuesta de la API es `no-store`.
const PROD={NODE_ENV:"production",NEXT_PUBLIC_AUTH0_DOMAIN:"clinica.us.auth0.com"};
const directive=(csp:string,name:string)=>csp.split("; ").find(d=>d.startsWith(name+" "))??"";

describe("cabeceras de seguridad (S-04)",()=>{
 it("la configuración de Next las aplica a TODAS las rutas y `no-store` a toda la API",async()=>{
  const rules=await nextConfig.headers!();
  const all=rules.find(r=>r.source==="/:path*");const api=rules.find(r=>r.source==="/api/:path*");
  expect(all?.headers.map(h=>h.key)).toEqual(expect.arrayContaining(["Strict-Transport-Security","X-Frame-Options","X-Content-Type-Options","Referrer-Policy","Permissions-Policy"]));
  // S-04: la CSP de las páginas la fija el middleware (nonce por petición); la API lleva la estática + no-store
  expect(api?.headers).toEqual([{key:"Cache-Control",value:"no-store"},{key:"Pragma",value:"no-cache"},{key:"Content-Security-Policy",value:contentSecurityPolicy()}]);
  expect(API_NO_STORE[0]).toEqual({key:"Cache-Control",value:"no-store"});
  expect(nextConfig.poweredByHeader).toBe(false);
 });
 it("valores que importan: anti-clickjacking, sin sniffing, sin Referer (las rutas llevan ids de paciente), HSTS de 2 años",()=>{
  const h=Object.fromEntries(securityHeaders(PROD).map(x=>[x.key,x.value]));
  expect(h["X-Frame-Options"]).toBe("DENY");expect(h["X-Content-Type-Options"]).toBe("nosniff");expect(h["Referrer-Policy"]).toBe("no-referrer");
  expect(h["Strict-Transport-Security"]).toMatch(/max-age=63072000; includeSubDomains/);
  expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
 });
});
// Auditoría S-04: las páginas HTML reciben una CSP con nonce por petición desde el middleware; ningún script en línea sin
// nonce se ejecuta ('strict-dynamic'); la política estática queda para la API y los estáticos, que no son HTML.
describe("Content-Security-Policy con nonce (páginas, S-04)",()=>{
 it("con nonce, script-src no lleva 'unsafe-inline' y exige el nonce con 'strict-dynamic'",()=>{
  const c=contentSecurityPolicy(PROD,"abc123");
  expect(directive(c,"script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  expect(directive(contentSecurityPolicy({NODE_ENV:"development"},"n"),"script-src")).toBe("script-src 'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'");
  expect(directive(c,"style-src-elem")).toBe("style-src-elem 'self' 'nonce-abc123'"); // ningún <style> inyectado sin nonce
  expect(directive(c,"style-src-attr")).toBe("style-src-attr 'unsafe-inline'"); // atributos style del SSR de React
  expect(directive(c,"style-src")).toBe("style-src 'self' 'unsafe-inline'"); // respaldo para navegadores sin CSP3
 });
 it("el config estático no fija CSP para las páginas (la pone el middleware) pero sí para la API y los estáticos",async()=>{
  const hs=await (nextConfig.headers as ()=>Promise<{source:string;headers:{key:string;value:string}[]}[]>)();
  const pages=hs.find(h=>h.source==="/:path*")!;expect(pages.headers.some(h=>h.key==="Content-Security-Policy")).toBe(false);
  expect(pages.headers.some(h=>h.key==="Strict-Transport-Security")).toBe(true);
  for(const src of["/api/:path*","/_next/:path*"])expect(hs.find(h=>h.source===src)!.headers.some(h=>h.key==="Content-Security-Policy")).toBe(true);
 });
});
describe("Content-Security-Policy",()=>{
 const csp=contentSecurityPolicy(PROD);
 it("por defecto solo el propio origen; nada de plugins, base ajena, formularios ajenos ni incrustación",()=>{
  expect(directive(csp,"default-src")).toBe("default-src 'self'");
  expect(directive(csp,"object-src")).toBe("object-src 'none'");expect(directive(csp,"base-uri")).toBe("base-uri 'self'");
  expect(directive(csp,"form-action")).toBe("form-action 'self'");expect(directive(csp,"frame-ancestors")).toBe("frame-ancestors 'none'");
  expect(csp).toContain("upgrade-insecure-requests");
 });
 it("el ÚNICO origen externo es el IdP, y solo para conectar y para su iframe de renovación",()=>{
  expect(directive(csp,"connect-src")).toBe("connect-src 'self' https://clinica.us.auth0.com");
  expect(directive(csp,"frame-src")).toBe("frame-src https://clinica.us.auth0.com");
  expect(directive(csp,"script-src")).toBe("script-src 'self' 'unsafe-inline'"); // política estática (API/estáticos): sin terceros ni eval en producción
  expect(csp.match(/https?:\/\/[^\s;]+/g)).toEqual(["https://clinica.us.auth0.com","https://clinica.us.auth0.com"]);
 });
 it("sin IdP configurado no se abre ningún origen externo",()=>{
  const c=contentSecurityPolicy({NODE_ENV:"production"});
  expect(directive(c,"connect-src")).toBe("connect-src 'self'");expect(directive(c,"frame-src")).toBe("frame-src 'none'");
 });
 it("eval y websockets solo en desarrollo (React Refresh)",()=>{
  expect(contentSecurityPolicy({NODE_ENV:"development"})).toMatch(/'unsafe-eval'/);
  expect(csp).not.toMatch(/unsafe-eval|ws:/);
 });
 it("un dominio de IdP malformado o malicioso no se inyecta en la política",()=>{
  for(const bad of["evil.com; script-src *","a b","https://x.com/path?y","'self' *"])expect(auth0Origin({NEXT_PUBLIC_AUTH0_DOMAIN:bad}),bad).toBe("");
  expect(auth0Origin({NEXT_PUBLIC_AUTH0_DOMAIN:"https://clinica.us.auth0.com/"})).toBe("https://clinica.us.auth0.com");
 });
});
