import{NextResponse}from"next/server";
import{isValidRfc}from"../../../packages/mx-identity/src";
import{isValidCedula}from"../../../packages/prescription-print/src";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{runClinicalCommand,officeSettings}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{assertReadVersion,buildCommand,principalFrom,resolveVerified,parseJson,requireMutationHeaders}from"./http-command";
// EPIC S-CONFIG — Ajustes del consultorio (singleton por tenant, NO PHI, sin paciente), sobre el mismo kernel
// event-sourced. Un unico agregado OfficeSettings por tenant (aggregateId constante; RLS separa por tenant).
// El estado actual se reconstruye del ultimo evento OFFICE_SETTINGS_UPDATED; version = nº de eventos (If-Match).
const AGG="OfficeSettings";
// R2B-025: propósitos bajo los que configurar el consultorio es legítimo. RESEARCH y BILLING quedan FUERA a propósito: una
// sesión de investigación no tiene por qué poder cambiar el RFC, la cédula o las alertas de seguimiento de la clínica.
const ADMIN_PURPOSES=["TREATMENT","OPERATIONS"] as const;
// UUID constante del singleton. La unicidad del kernel es por (tenant_id, aggregate_id), asi que el mismo id
// bajo distintos tenants no colisiona (cada tenant tiene su propia serie de versiones).
export const OFFICE_SETTINGS_ID="0ff1ce00-0000-4000-8000-000000000001";

// Días de la semana (orden fijo) y módulos del sistema — catálogos canónicos de los ajustes de horario/módulos.
export const SCHEDULE_DAYS=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"] as const;
export const MODULE_KEYS=["Pacientes","Agenda","Consulta","Resultados","Órdenes","Interconsultas","Seguimiento","Facturación","Documentos","Obligaciones","Clinical Intelligence","Reportes","Biblioteca clínica"] as const;
// Horario por defecto del consultorio: L–V 08:00–15:00, Sáb 08:00–13:00, Dom cerrado.
export const DEFAULT_SCHEDULE=SCHEDULE_DAYS.map(day=>{
 if(day==="Domingo")return{day,open:false,from:"",to:""};
 if(day==="Sábado")return{day,open:true,from:"08:00",to:"13:00"};
 return{day,open:true,from:"08:00",to:"15:00"};
});
// Módulos activos por defecto: todos habilitados.
export const DEFAULT_MODULES:Record<string,boolean>=Object.fromEntries(MODULE_KEYS.map(k=>[k,true]));

// Valores por defecto de los ajustes persistibles. El resto de la vista Configuracion sigue siendo presentacional.
export const DEFAULT_OFFICE_SETTINGS={
 officeName:"",specialty:"",rfc:"",cedula:"",address:"",phone:"",email:"",timezone:"",language:"es",
 color:"#6C5CF6",theme:"Claro",fontSize:"Normal",
 realtimeAlerts:true,followupReminders:true,showInteractions:true,darkMode:false,
 schedule:DEFAULT_SCHEDULE,modules:DEFAULT_MODULES,
 // Preferencias de consulta
 prefRecordView:"Resumen clínico",prefNoteTemplate:"Consulta general (SOAP)",prefUnits:"Métrico (kg, cm)",prefDoseCalc:"Pediátrica y adultos",
 // Configuraciones regionales
 regCountry:"México",regState:"",regCity:"",regPostalCode:"",regDateFormat:"dd/mm/aaaa",regTimeFormat:"24 horas",regCurrency:"MXN",regTaxRate:"16",
} as const;

// Una fila de horario: día conocido, abierto/cerrado y las horas (HH:MM o vacío si está cerrado).
const HHMM=/^([01]\d|2[0-3]):[0-5]\d$/;
const ScheduleRow=z.object({day:z.enum(SCHEDULE_DAYS),open:z.boolean(),
 from:z.string().refine(v=>v===""||HHMM.test(v),"HH:MM"),to:z.string().refine(v=>v===""||HHMM.test(v),"HH:MM")}).strict();

// Todos los campos son opcionales en la entrada: se hace merge sobre los ajustes actuales (o los defaults).
const SettingsSchema=z.object({
 officeName:z.string().max(200).optional(),specialty:z.string().max(120).optional(),rfc:z.string().trim().max(20).optional().refine(v=>v===undefined||v===""||isValidRfc(v),"El RFC no tiene la forma de un RFC mexicano (3 o 4 letras, 6 dígitos de fecha y 3 de homoclave)."),
 // R04-F02: la cédula se valida con la MISMA definición que exige la receta legal (packages/prescription-print), no con
 // una segunda regla: si el sistema acepta aquí una cédula que la receta rechaza, el consultorio queda configurado con un
 // dato que no sirve para prescribir y el médico lo descubre al firmar.
 cedula:z.string().trim().max(30).optional().refine(v=>v===undefined||v===""||isValidCedula(v),"La cédula profesional debe tener 7 u 8 dígitos."),address:z.string().max(300).optional(),phone:z.string().max(40).optional(),
 email:z.string().max(120).optional(),timezone:z.string().max(80).optional(),language:z.string().max(40).optional(),
 color:z.string().max(9).optional(),theme:z.string().max(20).optional(),fontSize:z.string().max(20).optional(),
 realtimeAlerts:z.boolean().optional(),followupReminders:z.boolean().optional(),showInteractions:z.boolean().optional(),darkMode:z.boolean().optional(),
 schedule:z.array(ScheduleRow).max(7).optional(),
 // Módulos: mapa parcial módulo->activo. Se acepta un subconjunto, pero solo claves de módulos conocidos.
 modules:z.record(z.string().max(40),z.boolean()).refine(m=>Object.keys(m).every(k=>(MODULE_KEYS as readonly string[]).includes(k)),"Módulo desconocido").optional(),
 // Preferencias de consulta (presentacionales pero persistidas por consultorio)
 prefRecordView:z.string().max(60).optional(),prefNoteTemplate:z.string().max(80).optional(),prefUnits:z.string().max(40).optional(),prefDoseCalc:z.string().max(60).optional(),
 // Configuraciones regionales
 regCountry:z.string().max(60).optional(),regState:z.string().max(60).optional(),regCity:z.string().max(60).optional(),regPostalCode:z.string().max(12).optional(),
 regDateFormat:z.string().max(20).optional(),regTimeFormat:z.string().max(20).optional(),regCurrency:z.string().max(10).optional(),regTaxRate:z.string().max(6).optional(),
 // R03-08: altitud de la sede en metros, como texto (el resto de campos regionales también lo son). Cadena vacía = no
 // declarada. Se valida el rango porque de aquí sale la presión atmosférica del gradiente A-a.
 altitudeMeters:z.string().max(6).refine(v=>v===""||(Number.isFinite(Number(v))&&Number(v)>=-500&&Number(v)<=6000),"Altitud en metros entre -500 y 6000").optional(),
}).strict();
export const UpdateBody=z.object({settings:SettingsSchema,occurredAt:z.string().datetime()});

// GET — devuelve los ajustes efectivos (defaults + lo persistido) y la version para el If-Match del siguiente PUT.
export async function handleOfficeSettingsGet(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  // R2B-025: el propósito SE COMPRUEBA. Antes no se pasaba ninguno y, como `authorize` solo compara el propósito cuando el
  // llamador lo declara, la comprobación no existía: una sesión de investigación o de facturación leía la configuración del
  // consultorio igual que el médico. Configurar el consultorio es legítimo bajo atención o bajo operación; no bajo las otras.
  authorize(principalFrom(claims),{scope:"settings:read",purpose:ADMIN_PURPOSES});
  const cur=await officeSettings(ctx);
  return NextResponse.json({settings:{...DEFAULT_OFFICE_SETTINGS,...cur.settings},version:cur.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// PUT — merge de los campos recibidos sobre los actuales; persiste el objeto COMPLETO en el evento (para que el
// read del ultimo evento sea autosuficiente). Concurrencia optimista via If-Match (expectedVersion = nº de eventos).
export async function handleOfficeSettingsUpdate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"settings:write",purpose:ADMIN_PURPOSES});
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const b=await parseJson(req,UpdateBody);
  const cur=await officeSettings(ctx);
  assertReadVersion("Settings changed since last read",expectedVersion,cur.version);
  // Merge: los escalares y el horario se reemplazan por lo recibido; los MÓDULOS se fusionan en profundidad
  // (un PUT parcial de módulos preserva los no enviados). schedule llega completo desde la UI.
  const curModules=(cur.settings.modules as Record<string,boolean>|undefined)??{};
  const merged={...DEFAULT_OFFICE_SETTINGS,...cur.settings,...b.settings,
   modules:{...DEFAULT_MODULES,...curModules,...(b.settings.modules??{})}};
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:OFFICE_SETTINGS_ID,expectedVersion,eventType:"OFFICE_SETTINGS_UPDATED",payload:{kind:"UPDATED",settings:merged},occurredAt:b.occurredAt,topic:"office_settings.updated"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({settings:merged,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
