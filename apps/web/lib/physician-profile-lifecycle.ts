import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{put,del,get}from"@vercel/blob";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{z}from"zod";
import{buildCommand,principalFrom,resolveVerified,parseJson}from"./http-command";
import{isValidCedula,type PrescriberIdentity}from"../../../packages/prescription-print/src";
import{deterministicUuid}from"../../../packages/canonical-json/src";
// EPIC S-CONFIG/FIRMA — Perfil del MÉDICO (firma y sello) sobre el kernel event-sourced. La firma/sello son
// del médico (no del consultorio): el agregado es por-usuario (aggregateId derivado del sub del médico; RLS por
// tenant). Las imágenes (PHI de identidad profesional) viven SOLO en Vercel Blob PRIVADO; en el event stream va
// únicamente la referencia (pathname + sha256 + metadatos). version = nº de eventos (If-Match implícito por conteo).
const AGG="PhysicianProfile";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};
const ASSET_KINDS=["signature","stamp"]as const;
type AssetKind=(typeof ASSET_KINDS)[number];
const MAX_ASSET_BYTES=5*1024*1024; // 5 MB (imágenes de firma/sello)
const ALLOWED_MIME=new Set(["image/png","image/jpeg","image/webp"]);
const EXT_BY_MIME:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
const derivedUuid=(seed:string):string=>deterministicUuid(seed); // R01-015: una sola derivación en todo el repo
function blobToken():string{const t=process.env.BLOB_READ_WRITE_TOKEN;if(!t)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","Blob store no configurado (BLOB_READ_WRITE_TOKEN ausente)");return t;}
// El agregado del perfil es por-médico dentro del tenant (RLS separa tenants).
function profileId(c:Claims):string{return derivedUuid(`physician-profile:${c.tenantId}:${c.sub}`);}

export type ProfileAsset=Readonly<{pathname:string;mime:string;size:number;contentHash:string;setAt:string}>;
// Auditoría L-05: identidad profesional del MÉDICO (no del consultorio): nombre completo, cédula profesional (7–8 dígitos,
// DGP/SEP), institución que expidió el título (LGS art. 83) y, si aplica, especialidad y cédula de especialidad. Es lo que la
// ley exige en la receta y lo que PRESCRIBE y la firma exigen antes de ejecutarse (ver `requirePhysicianCredentials`).
export type PhysicianCredentials=PrescriberIdentity&Readonly<{setAt:string}>;
export type PhysicianProfileRead=Readonly<{signature:ProfileAsset|null;stamp:ProfileAsset|null;credentials:PhysicianCredentials|null;version:number}>;
// Pliega los eventos del perfil: el último ASSET_SET por tipo gana; ASSET_REMOVED lo limpia; el último CREDENTIALS_SET gana.
// version = nº eventos.
async function foldProfile(ctx:Parameters<typeof readAggregateEvents>[0],aggId:string):Promise<PhysicianProfileRead>{
 const events=await readAggregateEvents(ctx,aggId);
 let signature:ProfileAsset|null=null,stamp:ProfileAsset|null=null,credentials:PhysicianCredentials|null=null;
 for(const e of events){const p=e.payload;const k=String(p.kind);
  if(k==="ASSET_SET"){const a:ProfileAsset={pathname:String(p.pathname??""),mime:String(p.mime??"image/png"),size:Number(p.size??0),contentHash:String(p.contentHash??""),setAt:String(p.setAt??"")};if(p.assetKind==="signature")signature=a;else if(p.assetKind==="stamp")stamp=a;}
  else if(k==="ASSET_REMOVED"){if(p.assetKind==="signature")signature=null;else if(p.assetKind==="stamp")stamp=null;}
  else if(k==="CREDENTIALS_SET"){const s=(x:unknown)=>typeof x==="string"&&x.trim()!==""?x:undefined;
   credentials={fullName:String(p.fullName??""),cedulaProfesional:String(p.cedulaProfesional??""),institution:String(p.institution??""),setAt:String(p.setAt??""),
    ...(s(p.specialty)?{specialty:String(p.specialty)}:{}),...(s(p.cedulaEspecialidad)?{cedulaEspecialidad:String(p.cedulaEspecialidad)}:{})};}
 }
 return{signature,stamp,credentials,version:events.length};
}
// Lectura de las credenciales del médico autenticado (null si nunca las registró). Para PRESCRIBE, firma y receta.
export async function physicianCredentials(ctx:Parameters<typeof readAggregateEvents>[0],claims:{sub:string;tenantId:string}):Promise<PhysicianCredentials|null>{
 return(await foldProfile(ctx,profileId(claims as Claims))).credentials;
}
// Physician Control con identidad legal: sin cédula profesional registrada no se prescribe ni se firma (428, con `reason`
// estable para que la UI lleve al perfil profesional). No es un flag: es la condición legal del acto.
export function assertPhysicianCredentials(c:PhysicianCredentials|null):PhysicianCredentials{
 if(!c)throw new ClinicalError("PRECONDITION_REQUIRED","Cédula profesional no registrada: complete su perfil profesional (nombre, cédula e institución que expidió el título) antes de prescribir o firmar",{reason:"PHYSICIAN_CREDENTIALS_REQUIRED"});
 return c;
}
export async function requirePhysicianCredentials(ctx:Parameters<typeof readAggregateEvents>[0],claims:{sub:string;tenantId:string}):Promise<PhysicianCredentials>{
 return assertPhysicianCredentials(await physicianCredentials(ctx,claims));
}
const CEDULA_MSG="cédula profesional de 7 u 8 dígitos";
export const CredentialsBody=z.object({
 fullName:z.string().trim().min(3).max(160),
 cedulaProfesional:z.string().trim().refine(isValidCedula,CEDULA_MSG),
 institution:z.string().trim().min(2).max(200),
 specialty:z.string().trim().max(120).optional(),
 cedulaEspecialidad:z.string().trim().refine(v=>v===""||isValidCedula(v),CEDULA_MSG).optional(),
}).strict();
// POST /api/v1/physician-profile/credentials -> registra (o sustituye) la identidad profesional del médico autenticado.
// Solo un MÉDICO registra su propia cédula; queda como evento inmutable (quién, cuándo, qué) en su perfil.
export async function handleCredentialsSet(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,role:"PHYSICIAN",scope:"settings:write"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CredentialsBody);
  const aggId=profileId(c);const setAt=new Date().toISOString();
  const profile=await foldProfile(ctx,aggId);
  const payload:Record<string,unknown>={kind:"CREDENTIALS_SET",fullName:b.fullName,cedulaProfesional:b.cedulaProfesional,institution:b.institution,authorId:c.sub,setAt};
  if(b.specialty)payload["specialty"]=b.specialty;if(b.cedulaEspecialidad)payload["cedulaEspecialidad"]=b.cedulaEspecialidad;
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:aggId,expectedVersion:profile.version,eventType:"PROFILE_CREDENTIALS_SET",payload,occurredAt:setAt,topic:"physician_profile.credentials_set"});
  let result=await lookupReplay(ctx,cmd);
  if(!result)result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({credentials:{fullName:b.fullName,cedulaProfesional:b.cedulaProfesional,institution:b.institution,...(b.specialty?{specialty:b.specialty}:{}),...(b.cedulaEspecialidad?{cedulaEspecialidad:b.cedulaEspecialidad}:{})},version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
function assetOf(profile:PhysicianProfileRead,kind:AssetKind):ProfileAsset|null{return kind==="signature"?profile.signature:profile.stamp;}

// GET /api/v1/physician-profile -> metadatos de firma y sello del médico (sin binarios) + version.
export async function handleProfileGet(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"settings:read"});
  const profile=await foldProfile(ctx,profileId(c));
  return NextResponse.json(profile,{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// POST /api/v1/physician-profile/assets/:kind (multipart, campo "file") -> sube la imagen al Blob privado y
// registra PROFILE_ASSET_SET (solo la referencia). Sube PRIMERO; si el commit falla, borra el blob (sin huérfanos).
export async function handleProfileAssetUpload(req:Request,kind:string):Promise<Response>{
 try{
  if(!(ASSET_KINDS as readonly string[]).includes(kind))throw new ClinicalError("NOT_FOUND","Tipo de asset desconocido");
  const{claims,ctx}=resolveVerified(req);const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"settings:write"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const form=await req.formData().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","multipart/form-data con campo 'file' requerido");});
  const file=form.get("file");
  if(!(file instanceof File))throw new ClinicalError("VALIDATION_ERROR","Campo 'file' ausente o inválido");
  const mime=file.type||"application/octet-stream";
  if(!ALLOWED_MIME.has(mime))throw new ClinicalError("VALIDATION_ERROR",`Tipo no permitido (${mime}). Imágenes: PNG, JPG, WEBP`);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength===0)throw new ClinicalError("VALIDATION_ERROR","Archivo vacío");
  if(bytes.byteLength>MAX_ASSET_BYTES)throw new ClinicalError("VALIDATION_ERROR",`Imagen demasiado grande (${bytes.byteLength} bytes; máx ${MAX_ASSET_BYTES})`);
  const contentHash=crypto.createHash("sha256").update(bytes).digest("hex");
  const aggId=profileId(c);
  const pathname=`tenants/${c.tenantId}/physicians/${aggId}/${kind}.${EXT_BY_MIME[mime]??"png"}`;
  const setAt=new Date().toISOString();
  const profile=await foldProfile(ctx,aggId);
  await put(pathname,Buffer.from(bytes),{access:"private",token:blobToken(),contentType:mime,addRandomSuffix:false,allowOverwrite:true});
  try{
   const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:aggId,expectedVersion:profile.version,eventType:"PROFILE_ASSET_SET",payload:{kind:"ASSET_SET",assetKind:kind,pathname,mime,size:bytes.byteLength,contentHash,authorId:c.sub,setAt},occurredAt:setAt,topic:"physician_profile.asset_set"});
   let result=await lookupReplay(ctx,cmd);
   if(!result)result=await runClinicalCommand(ctx,cmd);
   const r=result.response as{version:number;auditHash?:string};
   return NextResponse.json({assetKind:kind,mime,size:bytes.byteLength,contentHash,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
  }catch(commitErr){
   await del(pathname,{token:blobToken()}).catch(()=>{/* mejor esfuerzo */});
   throw commitErr;
  }
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// GET /api/v1/physician-profile/assets/:kind -> descarga la imagen a través de la Function (privada).
export async function handleProfileAssetDownload(req:Request,kind:string):Promise<Response>{
 try{
  if(!(ASSET_KINDS as readonly string[]).includes(kind))throw new ClinicalError("NOT_FOUND","Tipo de asset desconocido");
  const{claims,ctx}=resolveVerified(req);const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"settings:read"});
  const profile=await foldProfile(ctx,profileId(c));
  const asset=assetOf(profile,kind as AssetKind);
  if(!asset)throw new ClinicalError("NOT_FOUND","Asset no encontrado");
  const res=await get(asset.pathname,{access:"private",token:blobToken(),useCache:false});
  if(!res||res.statusCode!==200||!res.stream)throw new ClinicalError("NOT_FOUND","Blob no encontrado");
  return new Response(res.stream,{status:200,headers:{"content-type":asset.mime,"cache-control":"private, no-store"}});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// DELETE /api/v1/physician-profile/assets/:kind -> quita la imagen (borra el blob + registra ASSET_REMOVED).
export async function handleProfileAssetRemove(req:Request,kind:string):Promise<Response>{
 try{
  if(!(ASSET_KINDS as readonly string[]).includes(kind))throw new ClinicalError("NOT_FOUND","Tipo de asset desconocido");
  const{claims,ctx}=resolveVerified(req);const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"settings:write"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const aggId=profileId(c);
  const profile=await foldProfile(ctx,aggId);
  const asset=assetOf(profile,kind as AssetKind);
  if(!asset)throw new ClinicalError("NOT_FOUND","Asset no encontrado");
  const removedAt=new Date().toISOString();
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:aggId,expectedVersion:profile.version,eventType:"PROFILE_ASSET_REMOVED",payload:{kind:"ASSET_REMOVED",assetKind:kind,authorId:c.sub,removedAt},occurredAt:removedAt,topic:"physician_profile.asset_removed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result)result=await runClinicalCommand(ctx,cmd);
  await del(asset.pathname,{token:blobToken()}).catch(()=>{/* ya pudo no existir */});
  const r=result.response as{version:number};
  return NextResponse.json({assetKind:kind,removed:true,version:r.version,replayed:result.replayed},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
