import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,officeSettings}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,resolveVerified,parseJson,requireMutationHeaders}from"./http-command";
// EPIC S-CONFIG — Ajustes del consultorio (singleton por tenant, NO PHI, sin paciente), sobre el mismo kernel
// event-sourced. Un unico agregado OfficeSettings por tenant (aggregateId constante; RLS separa por tenant).
// El estado actual se reconstruye del ultimo evento OFFICE_SETTINGS_UPDATED; version = nº de eventos (If-Match).
const AGG="OfficeSettings";
// UUID constante del singleton. La unicidad del kernel es por (tenant_id, aggregate_id), asi que el mismo id
// bajo distintos tenants no colisiona (cada tenant tiene su propia serie de versiones).
export const OFFICE_SETTINGS_ID="0ff1ce00-0000-4000-8000-000000000001";

// Valores por defecto de los ajustes persistibles. El resto de la vista Configuracion sigue siendo presentacional.
export const DEFAULT_OFFICE_SETTINGS={
 officeName:"",specialty:"",rfc:"",cedula:"",address:"",phone:"",email:"",timezone:"",language:"es",
 color:"#6C5CF6",theme:"Claro",fontSize:"Normal",
 realtimeAlerts:true,followupReminders:true,showInteractions:true,darkMode:false,
} as const;

// Todos los campos son opcionales en la entrada: se hace merge sobre los ajustes actuales (o los defaults).
const SettingsSchema=z.object({
 officeName:z.string().max(200).optional(),specialty:z.string().max(120).optional(),rfc:z.string().max(20).optional(),
 cedula:z.string().max(30).optional(),address:z.string().max(300).optional(),phone:z.string().max(40).optional(),
 email:z.string().max(120).optional(),timezone:z.string().max(80).optional(),language:z.string().max(40).optional(),
 color:z.string().max(9).optional(),theme:z.string().max(20).optional(),fontSize:z.string().max(20).optional(),
 realtimeAlerts:z.boolean().optional(),followupReminders:z.boolean().optional(),showInteractions:z.boolean().optional(),darkMode:z.boolean().optional(),
}).strict();
const UpdateBody=z.object({settings:SettingsSchema,occurredAt:z.string().datetime()});

// GET — devuelve los ajustes efectivos (defaults + lo persistido) y la version para el If-Match del siguiente PUT.
export async function handleOfficeSettingsGet(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"settings:write"});
  const cur=await officeSettings(ctx);
  return NextResponse.json({settings:{...DEFAULT_OFFICE_SETTINGS,...cur.settings},version:cur.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// PUT — merge de los campos recibidos sobre los actuales; persiste el objeto COMPLETO en el evento (para que el
// read del ultimo evento sea autosuficiente). Concurrencia optimista via If-Match (expectedVersion = nº de eventos).
export async function handleOfficeSettingsUpdate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"settings:write"});
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const b=await parseJson(req,UpdateBody);
  const cur=await officeSettings(ctx);
  if(cur.version!==expectedVersion)throw new ClinicalError("CONCURRENCY_CONFLICT","Settings changed since last read",{expected:expectedVersion,actual:cur.version});
  const merged={...DEFAULT_OFFICE_SETTINGS,...cur.settings,...b.settings};
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:OFFICE_SETTINGS_ID,expectedVersion,eventType:"OFFICE_SETTINGS_UPDATED",payload:{kind:"UPDATED",settings:merged},occurredAt:b.occurredAt,topic:"office_settings.updated"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({settings:merged,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
