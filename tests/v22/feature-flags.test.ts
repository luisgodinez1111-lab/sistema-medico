import{describe,it,expect,afterEach}from"vitest";
import fs from"node:fs";
import path from"node:path";
import{NextRequest}from"next/server";
import{HOSPITAL_VERTICALS,hospitalVerticalsEnabled,isHospitalVerticalPath,clientFeatures}from"../../apps/web/lib/feature-flags";
import{middleware,config}from"../../apps/web/middleware";
// Auditoría 2026-09-19 (L-10, L-11) — las verticales hospitalarias (transfusión sin ABO/Rh, "time-out" sin lista de
// verificación, diálisis, triage, admisión, muestras, heridas) están APAGADAS por defecto y, apagadas, responden 404.
const ORIGINAL=process.env.ENABLE_HOSPITAL_VERTICALS;
afterEach(()=>{if(ORIGINAL===undefined)delete process.env.ENABLE_HOSPITAL_VERTICALS;else process.env.ENABLE_HOSPITAL_VERTICALS=ORIGINAL;});
const hit=(p:string)=>middleware(new NextRequest(`https://clinic.test${p}`,{method:"POST"}));

describe("ENABLE_HOSPITAL_VERTICALS — solo el literal \"true\" enciende (fail-closed)",()=>{
 it("ausente o cualquier otro valor => apagado",()=>{
  for(const v of[undefined,"","1","TRUE","True","yes","on"," true","true "])expect(hospitalVerticalsEnabled({ENABLE_HOSPITAL_VERTICALS:v}),String(v)).toBe(false);
  expect(hospitalVerticalsEnabled({ENABLE_HOSPITAL_VERTICALS:"true"})).toBe(true);
  expect(clientFeatures({})).toEqual({hospitalVerticals:false});
 });
});
describe("isHospitalVerticalPath — coincide por SEGMENTO exacto, no por prefijo",()=>{
 it("las 7 verticales, con y sin subruta",()=>{
  for(const v of HOSPITAL_VERTICALS){
   expect(isHospitalVerticalPath(`/api/v1/${v}`),v).toBe(true);
   expect(isHospitalVerticalPath(`/api/v1/${v}/`),v).toBe(true);
   expect(isHospitalVerticalPath(`/api/v1/${v}/0b7c/start`),v).toBe(true);
  }
 });
 it("variantes de escritura que un enrutador podría normalizar",()=>{
  expect(isHospitalVerticalPath("/api/v1/Transfusions/x/crossmatch")).toBe(true);
  expect(isHospitalVerticalPath("//api//v1//triage")).toBe(true);
  expect(isHospitalVerticalPath("/api/v1/%74riage/x")).toBe(true); // %74 = "t"
 });
 it("rutas ambulatorias y parecidos NO son verticales hospitalarias",()=>{
  for(const p of["/api/v1/patients","/api/v1/results/abc","/api/v1/medications","/api/v1/triage-notes","/api/v1/woundsx","/api/v2/triage","/api/v1/","/api/v1","/workspace","/api/triage","/api/v1/patients/triage"])
   expect(isHospitalVerticalPath(p),p).toBe(false);
 });
});
describe("middleware — con el flag apagado las verticales responden 404 antes de cualquier handler",()=>{
 it("APAGADO (por defecto): 404 con la forma de error de la API y sin caché",async()=>{
  delete process.env.ENABLE_HOSPITAL_VERTICALS;
  for(const v of HOSPITAL_VERTICALS){
   const r=hit(`/api/v1/${v}/0b7c/start`);expect(r.status,v).toBe(404);
   expect(await r.json()).toEqual({error:{code:"NOT_FOUND",message:"Not found"}});expect(r.headers.get("cache-control")).toBe("no-store");
  }
 });
 it("ENCENDIDO: la petición continúa hacia su handler",()=>{
  process.env.ENABLE_HOSPITAL_VERTICALS="true";
  const r=hit("/api/v1/transfusions");expect(r.status).toBe(200);expect(r.headers.get("x-middleware-next")).toBe("1");
 });
 it("una ruta ambulatoria nunca se corta, esté el flag como esté",()=>{
  delete process.env.ENABLE_HOSPITAL_VERTICALS;
  expect(hit("/api/v1/patients").headers.get("x-middleware-next")).toBe("1");
 });
});
describe("coherencia — el matcher del middleware, la lista y el árbol de rutas dicen lo mismo",()=>{
 it("el middleware cubre toda la API v1 (el corte por flag decide por segmento; el límite de tasa aplica a todas las escrituras)",()=>{
  expect(config.matcher[0]).toBe("/api/v1/:path*");
  expect(config.matcher).toHaveLength(2); // S-04: el segundo patrón cubre las páginas HTML (nonce de CSP), no los estáticos
 });
 it("cada vertical existe como carpeta de rutas (si se renombra una, este test obliga a actualizar el flag)",()=>{
  for(const v of HOSPITAL_VERTICALS)expect(fs.existsSync(path.resolve("apps/web/app/api/v1",v)),v).toBe(true);
 });
 it("la UI no pinta los paneles hospitalarios sin que el servidor los declare encendidos",()=>{
  // K-09: los paneles hospitalarios viven en la vista del expediente (views/exp.tsx); el estado, en el modelo (model.tsx).
  const src=fs.readFileSync(path.resolve("apps/web/app/workspace/views/exp.tsx"),"utf8");
  for(const marker of["INTERNAMIENTO / HOSPITALIZACIÓN","MUESTRAS / CADENA DE CUSTODIA","TRIAGE / CLASIFICACIÓN DE ACUIDAD","HERIDAS / LESIONES POR PRESIÓN","TRANSFUSIONES","CIRUGÍA / QUIRÓFANO","DIÁLISIS"]){
   const i=src.indexOf(`{/* ${marker} */}`);expect(i,marker).toBeGreaterThan(-1);
   // Tras consolidar dieciséis pestañas en cinco (06-oct-2026) estas secciones viven en «Expediente» y su montaje
   // exige DOS condiciones: la pestaña activa Y la bandera. La propiedad que este guardarraíl protege —sin bandera no
   // se pinta— sigue intacta y es más estricta; lo que cambia es que la bandera ya no es la única guarda.
   expect(src.slice(i,i+160).replace(/\s+/g,""),marker).toContain('*/}{inTab("expediente")&&hospitalOn&&<section');
  }
  expect(fs.readFileSync(path.resolve("apps/web/app/workspace/model.tsx"),"utf8")).toMatch(/hospitalOn,setHospitalOn\]=useState(?:<boolean>)?\(false\)/); // estado inicial apagado
 });
});
